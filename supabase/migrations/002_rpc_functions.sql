-- ==========================================
-- RPC functions for campaign counters
-- ==========================================

-- Increment sent_count and auto-complete campaign if all done
create or replace function increment_campaign_sent(campaign_id uuid)
returns void as $$
declare
  v_total int;
  v_sent int;
  v_failed int;
begin
  update campaigns
  set sent_count = sent_count + 1
  where id = campaign_id;

  select total_count, sent_count, failed_count
  into v_total, v_sent, v_failed
  from campaigns
  where id = campaign_id;

  if (v_sent + v_failed) >= v_total then
    update campaigns
    set status = 'completed', completed_at = now()
    where id = campaign_id;
  end if;
end;
$$ language plpgsql;

-- Increment failed_count and auto-complete campaign if all done
create or replace function increment_campaign_failed(campaign_id uuid)
returns void as $$
declare
  v_total int;
  v_sent int;
  v_failed int;
begin
  update campaigns
  set failed_count = failed_count + 1
  where id = campaign_id;

  select total_count, sent_count, failed_count
  into v_total, v_sent, v_failed
  from campaigns
  where id = campaign_id;

  if (v_sent + v_failed) >= v_total then
    update campaigns
    set status = 'completed', completed_at = now()
    where id = campaign_id;
  end if;
end;
$$ language plpgsql;
