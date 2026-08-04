-- Warsztat 2: Obrona wielowarstwowa — uruchom w Supabase Dashboard → SQL Editor → Run
-- Patrz lekcja_10/W2_OBRONA.md

create table if not exists message_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  message_length int not null
);

-- Przyspiesza liczenie wiadomości usera z ostatniej godziny (rate limiting)
create index if not exists message_logs_user_id_created_at_idx
  on message_logs (user_id, created_at);

alter table message_logs enable row level security;

create policy "Users manage own message logs" on message_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
