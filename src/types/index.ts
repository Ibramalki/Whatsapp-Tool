export type LeadStatus = 'new' | 'engaged' | 'offered' | 'converted'
export type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed'
export type MessageStatus = 'pending' | 'sending' | 'sent' | 'failed'

export interface Lead {
  id: string
  name: string
  phone: string
  grade: string | null
  status: LeadStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Template {
  id: string
  name: string
  content: string
  created_at: string
  updated_at: string
}

export interface AudienceFilter {
  grade?: string[]
  status?: LeadStatus[]
}

export interface Campaign {
  id: string
  name: string
  template_id: string | null
  audience_filter: AudienceFilter
  status: CampaignStatus
  total_count: number
  sent_count: number
  failed_count: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  // joined
  templates?: Template
}

export interface MessageQueue {
  id: string
  campaign_id: string | null
  lead_id: string | null
  phone: string
  message: string
  status: MessageStatus
  attempts: number
  max_attempts: number
  scheduled_at: string
  sent_at: string | null
  error: string | null
  created_at: string
}

export interface MessageLog {
  id: string
  lead_id: string | null
  campaign_id: string | null
  phone: string
  message: string
  status: 'sent' | 'failed'
  error: string | null
  sent_at: string
  // joined
  leads?: Pick<Lead, 'name' | 'phone'>
  campaigns?: Pick<Campaign, 'name'>
}

// CSV import row type
export interface CSVRow {
  name: string
  phone: string
  grade?: string
}
