-- Warsztat 3 (L09): Webhook — uruchom w Supabase Dashboard → SQL Editor → Run
-- Patrz lekcja_09/W3_WEBHOOK.md

create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null,
  data jsonb not null,
  analysis text not null
);
