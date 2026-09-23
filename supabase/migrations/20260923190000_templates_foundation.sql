create type public.template_channel as enum (
  'whatsapp',
  'email',
  'system',
  'document'
);

create table public.company_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_key text not null,
  label text not null,
  channel public.template_channel not null,
  subject text,
  body text not null default '',
  variables jsonb not null default '[]'::jsonb,
  is_active boolean not null default false,
  requires_human_review boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (company_id, template_key)
);

alter table public.company_templates enable row level security;

grant select, update on public.company_templates to authenticated;

create policy "members can read templates"
on public.company_templates
for select
to authenticated
using (app_private.is_company_member(company_id));

create policy "senior approvers can update templates"
on public.company_templates
for update
to authenticated
using (app_private.has_company_permission(company_id, 'approvals.perform'))
with check (app_private.has_company_permission(company_id, 'approvals.perform'));

insert into public.company_templates (
  company_id,
  template_key,
  label,
  channel,
  body,
  is_active,
  requires_human_review
)
select
  c.id,
  seed.template_key,
  seed.label,
  seed.channel::public.template_channel,
  '',
  false,
  true
from public.companies c
cross join (
  values
    ('whatsapp', 'WhatsApp', 'whatsapp'),
    ('email', 'Email', 'email'),
    ('creator_outreach', 'Creator outreach', 'whatsapp'),
    ('brief_notifications', 'Brief notifications', 'system'),
    ('counter_messages', 'Counter messages', 'whatsapp'),
    ('kyc_reminders', 'KYC reminders', 'system'),
    ('payment_payout', 'Payment / payout', 'system'),
    ('contracts', 'Contracts', 'document'),
    ('purchase_order', 'PO', 'document'),
    ('invoices', 'Invoices', 'document')
) as seed(template_key, label, channel)
where c.slug = 'storyloop'
on conflict (company_id, template_key) do nothing;
