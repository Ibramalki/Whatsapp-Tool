import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createWasender, WasenderAPIError, type RetryConfig } from 'wasenderapi'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// SDK handles HTTP 429 rate-limit retries automatically
const retryOptions: RetryConfig = {
  enabled: true,
  maxRetries: 3,
}

const wasender = createWasender(
  process.env.WASENDER_API_KEY,
  undefined,
  undefined,
  undefined,
  retryOptions
)

// Anti-spam delay between messages (random 3–10 seconds)
const MIN_DELAY_MS = 3_000
const MAX_DELAY_MS = 10_000

function randomDelay() {
  const ms = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Pick the oldest pending message ready to send
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

  // Mark as sending to prevent duplicate processing
  await supabase
    .from('message_queue')
    .update({ status: 'sending' })
    .eq('id', item.id)

  // Anti-spam delay before sending
  await randomDelay()

  // Format phone to E.164
  const formattedPhone = item.phone.startsWith('+')
    ? item.phone
    : `+${item.phone.replace(/[^\d]/g, '')}`

  try {
    const result = await wasender.sendText({
      to: formattedPhone,
      text: item.message,
    })

    // Success: mark sent and log
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

    // Increment campaign counter
    if (item.campaign_id) {
      await supabase.rpc('increment_campaign_sent', { campaign_id: item.campaign_id })
    }

    return res.status(200).json({
      success: true,
      rateLimit: result.rateLimit,
    })
  } catch (err) {
    let errorMessage = 'Unknown error'
    let isRateLimit = false

    if (err instanceof WasenderAPIError) {
      errorMessage = err.apiMessage || `HTTP ${err.statusCode}`
      isRateLimit = err.statusCode === 429
      console.error('WaSenderAPI Error:', {
        status: err.statusCode,
        message: err.apiMessage,
        details: err.errorDetails,
        rateLimit: err.rateLimit,
      })
    } else if (err instanceof Error) {
      errorMessage = err.message
    }

    const newAttempts = (item.attempts || 0) + 1
    const shouldRetry = newAttempts < item.max_attempts

    // Exponential backoff for retries: 30s → 60s → 120s
    // Rate-limit errors get longer backoff: 60s → 120s → 240s
    const baseDelay = isRateLimit ? 60_000 : 30_000
    const retryDelay = baseDelay * 2 ** (newAttempts - 1)

    await Promise.all([
      supabase
        .from('message_queue')
        .update({
          status: shouldRetry ? 'pending' : 'failed',
          attempts: newAttempts,
          error: errorMessage,
          ...(shouldRetry && {
            scheduled_at: new Date(Date.now() + retryDelay).toISOString(),
          }),
        })
        .eq('id', item.id),

      supabase.from('message_logs').insert({
        lead_id: item.lead_id,
        campaign_id: item.campaign_id,
        phone: formattedPhone,
        message: item.message,
        status: 'failed',
        error: errorMessage,
      }),
    ])

    if (!shouldRetry && item.campaign_id) {
      await supabase.rpc('increment_campaign_failed', { campaign_id: item.campaign_id })
    }

    return res.status(200).json({
      success: false,
      error: errorMessage,
      retrying: shouldRetry,
      nextAttempt: shouldRetry ? newAttempts + 1 : null,
    })
  }
}
