create type public.configuration_value_type as enum (
  'boolean',
  'integer',
  'number',
  'string'
);

create table public.company_configuration (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  key text not null,
  category text not null,
  label text not null,
  description text,
  value_type public.configuration_value_type not null,
  value jsonb,
  is_tbd boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (company_id, key)
);

alter table public.company_configuration enable row level security;

grant select, update on public.company_configuration to authenticated;

create policy "members can read company configuration"
on public.company_configuration
for select
to authenticated
using (app_private.is_company_member(company_id));

create policy "senior approvers can update company configuration"
on public.company_configuration
for update
to authenticated
using (app_private.has_company_permission(company_id, 'approvals.perform'))
with check (app_private.has_company_permission(company_id, 'approvals.perform'));

insert into public.company_configuration (
  company_id, key, category, label, description, value_type, value, is_tbd
)
select
  c.id,
  seed.key,
  seed.category,
  seed.label,
  seed.description,
  seed.value_type::public.configuration_value_type,
  null,
  true
from public.companies c
cross join (
  values
    ('creator_paid_price', 'commercial', 'Creator paid price', 'Creator paid product price.', 'number'),
    ('studio_credit_allowance', 'commercial', 'Studio credit allowance', 'Credit allowance for Studio usage.', 'integer'),
    ('brand_pro_price', 'commercial', 'Brand Pro price', 'Brand Pro product price.', 'number'),
    ('basic_discovery_allowance', 'discovery', 'Basic discovery allowance', 'Default discovery allowance before caps or overrides.', 'integer'),
    ('competitor_limit', 'discovery', 'Competitor limit', 'Maximum competitor count where this configuration applies.', 'integer'),
    ('invite_lapse', 'workflow', 'Invite lapse', 'Time before an invitation lapses.', 'integer'),
    ('discovery_spend_cap', 'discovery', 'Discovery spend cap', 'Default discovery spend cap.', 'number'),
    ('freshness_threshold', 'workflow', 'Freshness threshold', 'Threshold used to decide when data is considered stale.', 'integer'),
    ('outreach_nudge_interval', 'workflow', 'Outreach nudge interval', 'Interval between outreach nudges.', 'integer'),
    ('candidate_deletion', 'workflow', 'Candidate deletion', 'Whether candidate deletion is available.', 'boolean'),
    ('revision_limit', 'workflow', 'Revision limit', 'Maximum configured revision count.', 'integer'),
    ('float_cap', 'commercial', 'Float cap', 'Configured financial float cap.', 'number'),
    ('ai_preview_availability', 'features', 'AI Preview', 'Whether AI Preview is available.', 'boolean'),
    ('feature_availability', 'features', 'Feature availability', 'General feature availability control for documented TBD features.', 'boolean')
) as seed(key, category, label, description, value_type)
where c.slug = 'storyloop'
on conflict (company_id, key) do nothing;
