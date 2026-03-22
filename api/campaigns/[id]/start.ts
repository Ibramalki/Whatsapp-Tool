import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import type { Lead, Template, AudienceFilter } from '../../../src/types'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function resolveTemplate(
  content: string,
  lead: Pick<Lead, 'name' | 'phone' | 'grade'>
): string {
  return content
    .replace(/\{\{name\}\}/g, lead.name || '')
    .replace(/\{\{phone\}\}/g, lead.phone || '')
    .replace(/\{\{grade\}\}/g, lead.grade || '')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const campaignId = req.query.id as string

  // Fetch campaign
  const { data: campaign, error: campError } = await supabase
    .from('campaigns')
    .select('*, templates(*)')
    .eq('id', campaignId)
    .single()

  if (campError || !campaign) {
    return res.status(404).json({ error: 'Campaign not found' })
  }

  if (campaign.status === 'running') {
    return res.status(400).json({ error: 'Campaign is already running' })
  }

  if (!campaign.template_id) {
    return res.status(400).json({ error: 'Campaign has no template' })
  }

  const template = campaign.templates as Template
  const filter = (campaign.audience_filter || {}) as AudienceFilter

  // Build leads query from audience_filter
  let query = supabase.from('leads').select('id, name, phone, grade, status')

  if (filter.grade && filter.grade.length > 0) {
    query = query.in('grade', filter.grade)
  }
  if (filter.status && filter.status.length > 0) {
    query = query.in('status', filter.status)
  }

  const { data: leads, error: leadsError } = await query

  if (leadsError) {
    return res.status(500).json({ error: leadsError.message })
  }

  if (!leads || leads.length === 0) {
    return res.status(400).json({ error: 'No leads match this campaign filter' })
  }

  // Build queue entries with resolved messages
  const queueItems = (leads as Lead[]).map((lead) => ({
    campaign_id: campaignId,
    lead_id: lead.id,
    phone: lead.phone,
    message: resolveTemplate(template.content, lead),
    status: 'pending' as const,
  }))

  // Insert all items to queue
  const { error: insertError } = await supabase.from('message_queue').insert(queueItems)

  if (insertError) {
    return res.status(500).json({ error: insertError.message })
  }

  // Update campaign status to running
  await supabase
    .from('campaigns')
    .update({
      status: 'running',
      total_count: leads.length,
      sent_count: 0,
      failed_count: 0,
      started_at: new Date().toISOString(),
    })
    .eq('id', campaignId)

  return res.status(200).json({ success: true, total: leads.length })
}
