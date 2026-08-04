-- Warsztat 4: Panel bezpieczeństwa — uruchom w Supabase Dashboard → SQL Editor → Run
-- Patrz lekcja_10/W4_PANEL_BEZPIECZENSTWA.md

-- Rozszerza message_logs (patrz w2_message_logs.sql) o info potrzebne do panelu bezpieczeństwa:
-- czy wiadomość została zablokowana przez walidację, jej powód i skrócona treść.
alter table message_logs
  add column if not exists blocked boolean not null default false,
  add column if not exists block_reason text,
  add column if not exists message_preview text;

-- Przyspiesza listę zablokowanych wiadomości w panelu bezpieczeństwa
create index if not exists message_logs_blocked_created_at_idx
  on message_logs (blocked, created_at desc);
