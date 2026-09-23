alter table public.company_brand_settings
  add column if not exists primary_logo_meta jsonb,
  add column if not exists dark_logo_meta jsonb,
  add column if not exists light_logo_meta jsonb,
  add column if not exists favicon_meta jsonb;
