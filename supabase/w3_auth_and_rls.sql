-- Warsztat 3: Login i prywatne rozmowy — uruchom w Supabase Dashboard → SQL Editor → Run
-- Patrz lekcja_07/W3_LOGIN_PRYWATNOSC.md

-- 1) conversations: dodaj user_id
alter table conversations
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2) documents: dodaj user_id
alter table documents
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 3) Wyczyść stare dane sprzed logowania (nie mają właściciela — patrz krok 4 warsztatu)
delete from messages where conversation_id in (select id from conversations where user_id is null);
delete from conversations where user_id is null;
delete from documents where user_id is null;

-- 4) conversations.user_id musi być zawsze ustawione
alter table conversations alter column user_id set not null;

-- 5) user_profiles: id = auth.uid() zamiast bigint z localStorage
delete from user_profiles;
alter table user_profiles drop column id cascade;
alter table user_profiles
  add column id uuid primary key default auth.uid() references auth.users(id) on delete cascade;

-- 6) RLS — izolacja per user
alter table conversations enable row level security;
alter table messages enable row level security;
alter table documents enable row level security;
alter table user_profiles enable row level security;

create policy "Users manage own conversations" on conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage messages in own conversations" on messages
  for all using (
    exists (select 1 from conversations c where c.id = messages.conversation_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from conversations c where c.id = messages.conversation_id and c.user_id = auth.uid())
  );

create policy "Users manage own documents" on documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own profile" on user_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
