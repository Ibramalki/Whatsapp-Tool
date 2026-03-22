import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WASENDER_API_URL = 'https://www.wasenderapi.com/api/send-message'

// Random delay between MIN and MAX seconds (anti-spam)
const MIN_DELAY_MS = 3000
const MAX_DELAY_MS = 10000

function randomDelay() {
  return new Promise((resolve) =>
    setTimeout(resolve, MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS))
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Pick the oldest pending message that's ready to send
  const { data: items, error: fetchError } = await supabase
    .from('message_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(1)

  if (fetchError) {
    return res.status(500).json({ error: fetchError.message })
  }

  if (!items || items.length === 0) {
    return res.status(200).json({ success: true, done: true, message: 'Queue is empty' })
  }

  const item = items[0]

  // Mark as sending
  await supabase
    .from('message_queue')
    .update({ status: 'sending' })
    .eq('id', item.id)

  // Apply anti-spam delay
  await randomDelay()

  // Format phone
  const formattedPhone = item.phone.startsWith('+')
    ? item.phone
    : `+${item.phone.replace(/[^\d]/g, '')}`

  try {
    const waRes = await fetch(WASENDER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WASENDER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: formattedPhone, text: item.message }),
    })

    const waData = await waRes.json() as { success?: boolean; data?: { msgId?: string } }

    if (!waRes.ok || !waData.success) {
      throw new Error(JSON.stringify(waData))
    }

    // Success: update queue item and log
    await Promise.all([
      supabase
        .from('message_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', item.id),

      supabase.from('message_logs').insert({
        lead_id: item.lead_id,
        campaign_id: item.campaign_id,
        phone: formattedPhone,
        message: item.message,
        status: 'sent',
      }),
    ])

    // Update campaign sent_count
    if (item.campaign_id) {
      await supabase.rpc('increment_campaign_sent', { campaign_id: item.campaign_id })
    }

    return res.status(200).json({ success: true, message_id: waData.data?.msgId })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    const newAttempts = (item.attempts || 0) + 1
    const shouldRetry = newAttempts < item.max_attempts

    await Promise.all([
      supabase
        .from('message_queue')
        .update({
          status: shouldRetry ? 'pending' : 'failed',
          attempts: newAttempts,
          error,
          // Retry after exponential backoff: 30s, 60s, 120s
          ...(shouldRetry && {
            scheduled_at: new Date(Date.now() + 30_000 * 2 ** (newAttempts - 1)).toISOString(),
          }),
        })
        .eq('id', item.id),

      supabase.from('message_logs').insert({
        lead_id: item.lead_id,
        campaign_id: item.campaign_id,
        phone: formattedPhone,
        message: item.message,
        status: 'failed',
        error,
      }),
    ])

    // Update campaign failed_count if final failure
    if (!shouldRetry && item.campaign_id) {
      await supabase.rpc('increment_campaign_failed', { campaign_id: item.campaign_id })
    }

    return res.status(200).json({ success: false, error, retrying: shouldRetry })
  }
}
