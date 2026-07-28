-- Warsztat 1 (L09): Morning briefing — uruchom w Supabase Dashboard → SQL Editor → Run
-- Patrz lekcja_09/W1_MORNING_BRIEFING.md

create table if not exists briefings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  content text not null,
  date date not null,
  user_id uuid references auth.users(id) on delete cascade
);

-- Strona /briefings czyta tabelę z przeglądarki kluczem publicznym, więc bez polityki
-- SELECT lista jest zawsze pusta (RLS filtruje po cichu, bez błędu).
-- Briefingi są wspólne, nie per user: cron zapisuje je z user_id = null, więc polityka
-- nie może porównywać auth.uid() z user_id — odcięłaby wszystkie wpisy z crona.
-- Zapis nadal idzie wyłącznie kluczem serwisowym, który omija RLS.
alter table briefings enable row level security;

create policy "Authenticated users read briefings" on briefings
  for select to authenticated using (true);
