-- Warsztat 1 (L09): Morning briefing — uruchom w Supabase Dashboard → SQL Editor → Run
-- Patrz lekcja_09/W1_MORNING_BRIEFING.md

create table if not exists briefings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  content text not null,
  date date not null,
  user_id uuid references auth.users(id) on delete cascade
);
