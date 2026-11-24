-- ============================================================
-- BASELINE: speglar live-schemat i rwpmtithujtlojoizljb per 2026-07-06 (S28-3).
--
-- Bakgrund: de 4 remote-migrationerna (20260606124316, 20260607183533,
-- 20260607190426, 20260608054238) markerades som reverted i tracking-tabellen
-- under Del 3d-försöket 2026-07-05 (`supabase migration repair --status reverted`,
-- se audit/2026-07-05_s28-3-leverans.md) — historiken är därför tom medan schemat
-- är intakt. Denna baseline ersätter dem: genererad via introspektion av
-- live-databasen (pg_catalog/information_schema via Supabase MCP), inte via
-- `supabase db pull` (Docker-blockerat). Verifiera vid tillfälle med:
--   supabase db diff --linked        (ska vara tom mot denna baseline)
--
-- OBS: Kör INTE denna fil mot produktionsdatabasen — schemat finns redan där.
-- Den är registrerad som applicerad i supabase_migrations.schema_migrations
-- (gjort via MCP 2026-07-06); `supabase db pull`/`db push` är därmed i synk.
--
-- Ingår ej (hanteras utanför schemamigrationer):
--   * Storage bucket `contract-exports` (privat, signerade URL:er 1 h)
--   * Supabase-plattformens egna objekt (t.ex. funktionen rls_auto_enable)
-- ============================================================

-- ============================================================
-- FUNKTIONER
-- ============================================================
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- ============================================================
-- TABELLER
-- ============================================================

create table public.user_profiles (
  id uuid not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  display_name text not null,
  email text not null,
  phone text,
  trust_level text not null default 'org_nr'::text,
  personal_number_hash text,
  bankid_verified_at timestamp with time zone,
  org_number text,
  company_name text,
  company_data jsonb,
  company_fetched_at timestamp with time zone,
  id_document_url text,
  manual_verified_at timestamp with time zone,
  manual_verified_by text,
  is_existing_client boolean default false,
  client_reference text,
  conflict_check_result text,
  conflict_checked_at timestamp with time zone,
  active_products jsonb default '[]'::jsonb,
  subscription_status text default 'free'::text,
  engagements jsonb,
  constraint user_profiles_pkey primary key (id),
  constraint user_profiles_id_fkey foreign key (id) references auth.users(id)
);

create table public.ai_qa_reviews (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  source_type text not null,
  source_id uuid,
  user_id uuid,
  gemini_output jsonb not null,
  gemini_model text default 'gemini-2.5-flash'::text,
  gemini_tokens_in integer,
  gemini_tokens_out integer,
  gemini_latency_ms integer,
  qa_status text not null default 'pending'::text,
  qa_verdict jsonb,
  qa_issues jsonb default '[]'::jsonb,
  qa_confidence_score numeric,
  qa_model text default 'claude-sonnet-4-20250514'::text,
  qa_tokens_in integer,
  qa_tokens_out integer,
  qa_latency_ms integer,
  final_output jsonb,
  delivered_at timestamp with time zone,
  manual_reviewer text,
  manual_reviewed_at timestamp with time zone,
  manual_notes text,
  manual_corrections jsonb,
  issue_categories text[] default '{}'::text[],
  was_auto_correctable boolean,
  learning_notes text,
  constraint ai_qa_reviews_pkey primary key (id),
  constraint ai_qa_reviews_user_id_fkey foreign key (user_id) references auth.users(id)
);

create table public.health_check_results (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  org_number text not null,
  created_at timestamp with time zone default now(),
  company_data jsonb,
  analysis jsonb,
  score integer,
  areas jsonb,
  corrected_analysis jsonb,
  review_status text not null default 'ai_only'::text,
  reviewed_by text,
  reviewed_at timestamp with time zone,
  review_note text,
  regulatory_requirements jsonb,
  sni_code text,
  constraint health_check_results_pkey primary key (id),
  constraint health_check_results_user_id_fkey foreign key (user_id) references auth.users(id)
);

create table public.startup_kit_sessions (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  created_at timestamp with time zone default now(),
  form_data jsonb not null,
  generated_report jsonb,
  status text default 'pending'::text,
  checklist_progress jsonb default '[]'::jsonb,
  constraint startup_kit_sessions_pkey primary key (id),
  constraint startup_kit_sessions_user_id_fkey foreign key (user_id) references auth.users(id)
);

create table public.conflict_check_registry (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  personal_number text,
  org_number text,
  party_name text not null,
  matter_type text,
  notes text,
  is_active boolean default true,
  constraint conflict_check_registry_pkey primary key (id)
);

create table public.client_registry (
  id uuid not null default gen_random_uuid(),
  email text not null,
  phone text,
  name text not null,
  client_since timestamp with time zone,
  matter_types text[],
  is_active boolean default true,
  notes text,
  constraint client_registry_pkey primary key (id),
  constraint client_registry_email_key unique (email)
);

create table public.product_access (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  product text not null,
  granted_at timestamp with time zone default now(),
  expires_at timestamp with time zone,
  source text,
  payment_reference text,
  constraint product_access_pkey primary key (id),
  constraint product_access_user_id_fkey foreign key (user_id) references auth.users(id)
);

create table public.contracts (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  user_id uuid,
  org_number text,
  company_name text,
  contract_type text not null,
  title text,
  input_data jsonb not null,
  content_markdown text,
  review_points jsonb,
  status text not null default 'generated'::text,
  qa_review_id uuid,
  qa_status text,
  gemini_model text,
  generation_latency_ms integer,
  summary text,
  constraint contracts_pkey primary key (id),
  constraint contracts_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null,
  constraint contracts_qa_review_id_fkey foreign key (qa_review_id) references public.ai_qa_reviews(id) on delete set null,
  constraint contracts_status_check check (status = any (array['draft'::text, 'generated'::text, 'flagged'::text, 'final'::text])),
  constraint contracts_contract_type_check check (contract_type = any (array['nda'::text, 'employment'::text]))
);

-- ============================================================
-- INDEX
-- ============================================================
create index idx_user_profiles_org_number on public.user_profiles using btree (org_number);
create index idx_user_profiles_personal_number_hash on public.user_profiles using btree (personal_number_hash);
create index idx_user_profiles_trust_level on public.user_profiles using btree (trust_level);

create index idx_ai_qa_reviews_categories on public.ai_qa_reviews using gin (issue_categories);
create index idx_ai_qa_reviews_created on public.ai_qa_reviews using btree (created_at desc);
create index idx_ai_qa_reviews_flagged on public.ai_qa_reviews using btree (qa_status) where (qa_status = 'flagged'::text);
create index idx_ai_qa_reviews_source on public.ai_qa_reviews using btree (source_type, source_id);
create index idx_ai_qa_reviews_status on public.ai_qa_reviews using btree (qa_status);

create index idx_health_check_results_org_number on public.health_check_results using btree (org_number);
create index idx_health_check_results_user_id on public.health_check_results using btree (user_id);

create index idx_startup_kit_sessions_user_id on public.startup_kit_sessions using btree (user_id);

create index idx_conflict_check_registry_org_number on public.conflict_check_registry using btree (org_number);
create index idx_conflict_check_registry_party_name on public.conflict_check_registry using btree (party_name);
create index idx_conflict_check_registry_personal_number on public.conflict_check_registry using btree (personal_number);

create index idx_client_registry_email on public.client_registry using btree (email);

create index idx_product_access_product on public.product_access using btree (product);
create index idx_product_access_user_id on public.product_access using btree (user_id);

create index contracts_org_number_idx on public.contracts using btree (org_number);
create index contracts_user_id_idx on public.contracts using btree (user_id);

-- ============================================================
-- TRIGGERS
-- ============================================================
create trigger update_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- VY
-- ============================================================
create view public.ai_qa_dashboard as
select qa_status,
       source_type,
       count(*) as count,
       avg(qa_confidence_score) as avg_confidence,
       avg(gemini_latency_ms) as avg_gemini_ms,
       avg(qa_latency_ms) as avg_qa_ms
from public.ai_qa_reviews
group by qa_status, source_type
order by qa_status, source_type;

-- ============================================================
-- ROW LEVEL SECURITY (RLS aktiverat på samtliga 8 tabeller)
-- ============================================================
alter table public.user_profiles enable row level security;
alter table public.ai_qa_reviews enable row level security;
alter table public.health_check_results enable row level security;
alter table public.startup_kit_sessions enable row level security;
alter table public.conflict_check_registry enable row level security;
alter table public.client_registry enable row level security;
alter table public.product_access enable row level security;
alter table public.contracts enable row level security;

-- Policies (edge functions går via service role och berörs inte av RLS).
-- OBS: ai_qa_reviews, conflict_check_registry och client_registry har RLS
-- aktiverat UTAN policies — endast service role kommer åt dem. Avsiktligt.

create policy "Users can read own profile" on public.user_profiles
  for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.user_profiles
  for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.user_profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users can read own results" on public.health_check_results
  for select using (auth.uid() = user_id);
create policy "Users can insert own results" on public.health_check_results
  for insert with check (auth.uid() = user_id);

create policy "Users can read own sessions" on public.startup_kit_sessions
  for select using (auth.uid() = user_id);
create policy "Users can insert own sessions" on public.startup_kit_sessions
  for insert with check (auth.uid() = user_id);
create policy "Users can update own sessions" on public.startup_kit_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can read own access" on public.product_access
  for select using (auth.uid() = user_id);

create policy "contracts_select_own" on public.contracts
  for select using (auth.uid() = user_id);
