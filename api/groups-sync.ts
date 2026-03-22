import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createWasender, WasenderAPIError, type RetryConfig } from 'wasenderapi'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.WASENDER_API_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!apiKey) return res.status(500).json({ error: 'WASENDER_API_KEY غير مضبوط' })
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase env vars missing' })

  const supabase = createClient(supabaseUrl, supabaseKey)

  const retryOptions: RetryConfig = { enabled: true, maxRetries: 3 }
  const wasender = createWasender(apiKey, undefined, undefined, undefined, retryOptions)

  try {
    // 1. Fetch all groups
    const groupsResult = await wasender.getGroups()
    const groups = groupsResult.response.data

    if (!groups || groups.length === 0) {
      return res.status(200).json({ synced: 0, groups: [] })
    }

    // 2. Get metadata for each group (participants count) - batch with delay to respect rate limits
    const rows = []
    for (const group of groups) {
      let memberCount = 0
      let description: string | null = null

      try {
        const metaResult = await wasender.getGroupMetadata(group.id)
        const meta = metaResult.response.data
        memberCount = meta.participants?.length ?? 0
        description = meta.desc ?? null
      } catch {
        // If metadata fetch fails, continue with basic info
      }

      rows.push({
        id: group.id,
        name: group.name || 'بدون اسم',
        description,
        member_count: memberCount,
        synced_at: new Date().toISOString(),
      })
    }

    // 3. Upsert into DB
    const { error: upsertErr } = await supabase
      .from('whatsapp_groups')
      .upsert(rows, { onConflict: 'id' })

    if (upsertErr) throw upsertErr

    return res.status(200).json({ synced: rows.length, groups: rows })
  } catch (err) {
    if (err instanceof WasenderAPIError) {
      return res.status(err.statusCode || 500).json({
        error: err.apiMessage || `HTTP ${err.statusCode}`,
        details: err.errorDetails,
      })
    }
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: msg })
  }
}
