import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createWasender, WasenderAPIError, type RetryConfig } from 'wasenderapi'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Validate env vars first to return clean JSON errors
  const apiKey = process.env.WASENDER_API_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!apiKey) return res.status(500).json({ error: 'WASENDER_API_KEY غير مضبوط في Vercel' })
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase env vars missing' })

  const { phone, message, lead_id } = req.body as {
    phone: string
    message: string
    lead_id?: string
  }

  if (!phone || !message) {
    return res.status(400).json({ error: 'phone and message are required' })
  }

  // Format phone: ensure E.164 format
  const formattedPhone = phone.startsWith('+') ? phone : `+${phone.replace(/[^\d]/g, '')}`

  const supabase = createClient(supabaseUrl, supabaseKey)

  const retryOptions: RetryConfig = { enabled: true, maxRetries: 3 }
  const wasender = createWasender(apiKey, undefined, undefined, undefined, retryOptions)

  try {
    const result = await wasender.sendText({
      to: formattedPhone,
      text: message,
    })

    await supabase.from('message_logs').insert({
      lead_id: lead_id || null,
      phone: formattedPhone,
      message,
      status: 'sent',
    })

    return res.status(200).json({
      success: true,
      rateLimit: result.rateLimit,
    })
  } catch (err) {
    let errorMessage = 'Unknown error'

    if (err instanceof WasenderAPIError) {
      errorMessage = err.apiMessage || `HTTP ${err.statusCode}`
      console.error('WaSenderAPI Error:', {
        status: err.statusCode,
        message: err.apiMessage,
        details: err.errorDetails,
        rateLimit: err.rateLimit,
      })
    } else if (err instanceof Error) {
      errorMessage = err.message
    }

    await supabase.from('message_logs').insert({
      lead_id: lead_id || null,
      phone: formattedPhone,
      message,
      status: 'failed',
      error: errorMessage,
    })

    return res.status(500).json({ error: errorMessage })
  }
}
