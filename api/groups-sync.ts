import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.WASENDER_API_KEY

  if (!apiKey) return res.status(500).json({ error: 'WASENDER_API_KEY غير مضبوط في المتغيرات' })
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase env vars missing' })

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const groupsRes = await fetch('https://api.wasenderapi.com/api/groups', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!groupsRes.ok) {
      const errText = await groupsRes.text()
      return res.status(groupsRes.status).json({ error: `WaSenderAPI: ${errText.slice(0, 200)}` })
    }

    const data = await groupsRes.json()
    const rawGroups = Array.isArray(data) ? data : (data.data || data.groups || [])

    const rows = rawGroups.map((g: any) => ({
      id: String(g.id || g.groupId || g.jid || ''),
      name: g.name || g.subject || 'بدون اسم',
      description: g.description || null,
      member_count: g.participants?.length ?? g.size ?? g.memberCount ?? 0,
      message_count: g.messageCount ?? 0,
      joined_count: g.joinedCount ?? 0,
      left_count: g.leftCount ?? 0,
      created_at_wa: g.creation ? new Date(g.creation * 1000).toISOString() : null,
      synced_at: new Date().toISOString(),
    })).filter((r: any) => r.id)

    if (rows.length > 0) {
      const { error: upsertErr } = await supabase
        .from('whatsapp_groups')
        .upsert(rows, { onConflict: 'id' })
      if (upsertErr) throw upsertErr
    }

    return res.status(200).json({ synced: rows.length, groups: rows })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: msg })
  }
}
