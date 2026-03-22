export type LeadStatus = 'new' | 'engaged' | 'offered' | 'converted'
export type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed'
export type MessageStatus = 'pending' | 'sending' | 'sent' | 'failed'

export interface Lead {
  id: string
  name: string
  phone: string
  grade: string | null
  is_registered: boolean
  status: LeadStatus
  created_at: string
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

export type MessageType = 'custom' | 'lesson_content' | 'lesson_test' | 'tip'

export interface ScheduledMessage {
  id: string
  title: string
  message_type: MessageType
  content: string
  audience_filter: AudienceFilter
  scheduled_at: string
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  ai_topic: string | null
  ai_generated: boolean
  created_at: string
}

export interface WhatsAppGroup {
  id: string
  name: string
  description: string | null
  member_count: number
  created_at_wa: string | null
  synced_at: string
}

// CSV import row type - supports both English and Arabic column names
export interface CSVRow {
  // English column names (from export)
  'Full Name'?: string
  'Phone Number'?: string
  'Grade'?: string
  'Is Registered'?: string
  // Arabic/legacy column names
  name?: string
  phone?: string
  grade?: string
  is_registered?: string
}
