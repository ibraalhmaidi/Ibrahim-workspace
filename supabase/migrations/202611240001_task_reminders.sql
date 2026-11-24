-- Enable scheduled task reminders through OneSignal.
alter table public.tasks
  add column if not exists notified_at timestamptz;

create index if not exists tasks_due_reminders_idx
  on public.tasks (due)
  where done = false and notified_at is null and due is not null;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- The Vault secrets below must be created once in Supabase:
--   project_url = https://jcxdlcyolsbmmklcbwhb.supabase.co
--   service_role_key = your Supabase service_role key
-- The Edge Function also needs ONESIGNAL_REST_API_KEY configured as a function secret.

select cron.unschedule(jobid)
from cron.job
where jobname = 'send-task-reminders-every-minute';

select cron.schedule(
  'send-task-reminders-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/send-task-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
