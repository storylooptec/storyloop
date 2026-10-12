-- Provider invoices are actual subscription/account bills, separate from request-level cost estimates.
create table public.external_api_bills (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null check(provider_key in ('serpapi','openai','higgsfield','r2','supabase')),
  invoice_reference text not null check(char_length(invoice_reference) between 3 and 180),
  amount_usd numeric(12,2) not null check(amount_usd between 0 and 1000000000),
  currency text not null default 'USD' check(currency='USD'),
  billed_at date not null,
  period_start date not null,
  period_end date not null check(period_end >= period_start),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_key,invoice_reference)
);
create index external_api_bills_provider_date_idx on public.external_api_bills(provider_key,billed_at desc);
alter table public.external_api_bills enable row level security;
revoke all on public.external_api_bills from anon,authenticated;
grant select on public.external_api_bills to authenticated;
grant select,insert,update on public.external_api_bills to service_role;
create policy "operators read actual provider invoices" on public.external_api_bills for select to authenticated
using(app_private.is_storyloop_operator('operations.work'));
comment on table public.external_api_bills is 'Actual native-USD provider invoices. Do not sum with per-request billed amounts, which may already be included in the same invoice. Never infer allocation from subscription price.';
