-- Warsztat 3: Budżet kosztów — kontrola zużycia tokenów — uruchom w Supabase Dashboard → SQL Editor → Run
-- Patrz lekcja_10/W3_BUDZET.md

create table if not exists api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  tokens_input integer not null default 0,
  tokens_output integer not null default 0,
  model text not null,
  endpoint text not null
);

-- Przyspiesza liczenie zużycia tokenów usera z bieżącego dnia (limit dzienny)
create index if not exists api_usage_user_id_created_at_idx
  on api_usage (user_id, created_at);

alter table api_usage enable row level security;

create policy "Users manage own api usage" on api_usage
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
