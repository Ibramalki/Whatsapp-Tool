-- ==========================================
-- WhatsApp CRM Tool - Initial Schema
-- ==========================================

-- Leads table
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  grade text,
  status text not null default 'new'
    check (status in ('new', 'engaged', 'offered', 'converted')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Message Templates
create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Campaigns
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_id uuid references templates(id) on delete set null,
  audience_filter jsonb default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'running', 'paused', 'completed')),
  total_count int default 0,
  sent_count int default 0,
  failed_count int default 0,
  created_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- Message Queue
create table if not exists message_queue (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  phone text not null,
  message text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts int default 0,
  max_attempts int default 3,
  scheduled_at timestamptz default now(),
  sent_at timestamptz,
  error text,
  created_at timestamptz default now()
);

-- Message Logs (history of all sent messages)
create table if not exists message_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete set null,
  phone text not null,
  message text not null,
  status text not null check (status in ('sent', 'failed')),
  error text,
  sent_at timestamptz default now()
);

-- ==========================================
-- Indexes for performance
-- ==========================================
create index if not exists idx_leads_status on leads(status);
create index if not exists idx_leads_grade on leads(grade);
create index if not exists idx_message_queue_status on message_queue(status);
create index if not exists idx_message_queue_campaign on message_queue(campaign_id);
create index if not exists idx_message_logs_lead on message_logs(lead_id);
create index if not exists idx_message_logs_campaign on message_logs(campaign_id);
create index if not exists idx_message_logs_sent_at on message_logs(sent_at desc);

-- ==========================================
-- Auto-update updated_at
-- ==========================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_updated_at
  before update on leads
  for each row execute function update_updated_at();

create trigger templates_updated_at
  before update on templates
  for each row execute function update_updated_at();

-- ==========================================
-- Enable Realtime on campaigns table
-- ==========================================
alter publication supabase_realtime add table campaigns;
alter publication supabase_realtime add table message_queue;
