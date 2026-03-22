import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.WASENDER_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'WASENDER_API_KEY not configured' })

  try {
    // Fetch groups from WaSenderAPI
    const groupsRes = await fetch('https://api.wasenderapi.com/api/groups', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!groupsRes.ok) {
      const err = await groupsRes.text()
      return res.status(groupsRes.status).json({ error: `WaSenderAPI error: ${err}` })
    }

    const data = await groupsRes.json()
    const groups = data.data || data.groups || data || []

    const rows = groups.map((g: any) => ({
      id: g.id || g.groupId || g.jid,
      name: g.name || g.subject || 'بدون اسم',
      description: g.description || null,
      member_count: g.participants?.length || g.size || g.memberCount || 0,
      message_count: g.messageCount || 0,
      joined_count: g.joinedCount || 0,
      left_count: g.leftCount || 0,
      created_at_wa: g.creation ? new Date(g.creation * 1000).toISOString() : null,
      synced_at: new Date().toISOString(),
    }))

    if (rows.length) {
      await supabase
        .from('whatsapp_groups')
        .upsert(rows, { onConflict: 'id' })
    }

    return res.status(200).json({ synced: rows.length, groups: rows })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: msg })
  }
}
