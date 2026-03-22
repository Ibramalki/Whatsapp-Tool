// API client for calling Vercel API routes

const BASE = '/api'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return data as T
}

// Send a single message to a lead
export function sendMessage(payload: {
  phone: string
  message: string
  lead_id?: string
}) {
  return apiFetch<{ success: boolean; message_id?: string }>('/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// Start a campaign (builds the queue)
export function startCampaign(campaignId: string) {
  return apiFetch<{ success: boolean; total: number }>(`/campaigns/${campaignId}/start`, {
    method: 'POST',
  })
}

// Process next message in queue (called by frontend poller)
export function processQueue() {
  return apiFetch<{ success: boolean; done?: boolean; message?: string }>('/queue/process', {
    method: 'POST',
  })
}
