create type public.integration_state as enum (
  'disconnected',
  'mock',
  'sandbox',
  'live',
  'error'
);

create table public.company_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category text not null,
  provider_key text not null,
  label text not null,
  state public.integration_state not null default 'disconnected',
  non_secret_config jsonb not null default '{}'::jsonb,
  status_message text,
  updated_at timestamptz not null default now(),
  unique (company_id, provider_key)
);

alter table public.company_integrations enable row level security;

grant select, update on public.company_integrations to authenticated;

create policy "members can read integrations"
on public.company_integrations
for select
to authenticated
using (app_private.is_company_member(company_id));

create policy "senior approvers can update integrations"
on public.company_integrations
for update
to authenticated
using (app_private.has_company_permission(company_id, 'approvals.perform'))
with check (app_private.has_company_permission(company_id, 'approvals.perform'));

insert into public.company_integrations (
  company_id, category, provider_key, label, state, non_secret_config
)
select
  c.id,
  seed.category,
  seed.provider_key,
  seed.label,
  'mock'::public.integration_state,
  '{}'::jsonb
from public.companies c
cross join (
  values
    ('social', 'instagram', 'Instagram'),
    ('social', 'youtube', 'YouTube'),
    ('social', 'tiktok', 'TikTok'),
    ('messaging', 'whatsapp', 'WhatsApp'),
    ('messaging', 'email', 'Email'),
    ('messaging', 'push', 'Push'),
    ('ai', 'llm', 'LLM'),
    ('enrichment', 'search_enrichment', 'Search / Enrichment'),
    ('storage', 'cloudflare_r2', 'Cloudflare R2'),
    ('payments', 'payments', 'Payments'),
    ('identity', 'kyc', 'KYC'),
    ('legal', 'esign', 'E-sign'),
    ('tracking', 'tracking_attribution', 'Tracking / Attribution')
) as seed(category, provider_key, label)
where c.slug = 'storyloop'
on conflict (company_id, provider_key) do nothing;
