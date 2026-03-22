import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WASENDER_API_URL = 'https://www.wasenderapi.com/api/send-message'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { phone, message, lead_id } = req.body as {
    phone: string
    message: string
    lead_id?: string
  }

  if (!phone || !message) {
    return res.status(400).json({ error: 'phone and message are required' })
  }

  // Format phone: ensure it starts with +
  const formattedPhone = phone.startsWith('+') ? phone : `+${phone.replace(/[^\d]/g, '')}`

  try {
    const waRes = await fetch(WASENDER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WASENDER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: formattedPhone, text: message }),
    })

    const waData = await waRes.json() as { success?: boolean; data?: { msgId?: string } }

    if (!waRes.ok || !waData.success) {
      // Log failure
      await supabase.from('message_logs').insert({
        lead_id: lead_id || null,
        phone: formattedPhone,
        message,
        status: 'failed',
        error: JSON.stringify(waData),
      })
      return res.status(500).json({ error: 'WaSenderAPI error', details: waData })
    }

    // Log success
    await supabase.from('message_logs').insert({
      lead_id: lead_id || null,
      phone: formattedPhone,
      message,
      status: 'sent',
    })

    return res.status(200).json({ success: true, message_id: waData.data?.msgId })
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    await supabase.from('message_logs').insert({
      lead_id: lead_id || null,
      phone: formattedPhone,
      message,
      status: 'failed',
      error,
    })
    return res.status(500).json({ error })
  }
}
