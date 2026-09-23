create extension if not exists pgcrypto;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.creators (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  primary_handle text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_creators (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  status text,
  source text,
  commercial_relationship text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, creator_id)
);

create index company_creators_company_id_idx
  on public.company_creators(company_id);

create index company_creators_creator_id_idx
  on public.company_creators(creator_id);

alter table public.companies enable row level security;
alter table public.creators enable row level security;
alter table public.company_creators enable row level security;

revoke all on public.companies from anon, authenticated;
revoke all on public.creators from anon, authenticated;
revoke all on public.company_creators from anon, authenticated;

insert into public.companies (name, slug)
values ('Storyloop', 'storyloop')
on conflict (slug) do nothing;
