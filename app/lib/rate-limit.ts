import type { SupabaseClient } from "@supabase/supabase-js";

const LIMIT_PER_HOUR = 50;
const WINDOW_MS = 60 * 60 * 1000;

export type RateLimitResult = { ok: true } | { ok: false; message: string };

/**
 * Sprawdza limit 50 wiadomości/h per user (tabela message_logs, patrz supabase/w2_message_logs.sql)
 * i loguje bieżącą wiadomość. `supabase` musi być klientem autoryzowanym tokenem tego usera —
 * inaczej RLS zablokuje odczyt/zapis (patrz app/lib/supabase-server.ts).
 */
export async function checkAndLogMessage(
  userId: string,
  messageLength: number,
  supabase: SupabaseClient
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const { count, error: countError } = await supabase
    .from("message_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (countError) {
    // Fail-open: błąd bazy (np. brak tabeli przed uruchomieniem migracji) nie powinien
    // blokować całego czatu — logujemy i wpuszczamy wiadomość.
    console.error("Błąd odczytu message_logs (rate limit pominięty):", countError.message);
  } else if ((count ?? 0) >= LIMIT_PER_HOUR) {
    const { data: oldest } = await supabase
      .from("message_logs")
      .select("created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const retryAtMs = oldest?.created_at
      ? new Date(oldest.created_at).getTime() + WINDOW_MS
      : Date.now() + WINDOW_MS;
    const minutes = Math.max(1, Math.ceil((retryAtMs - Date.now()) / 60000));

    return {
      ok: false,
      message: `Osiągnąłeś limit wiadomości (${LIMIT_PER_HOUR}/h). Spróbuj za ${minutes} min.`,
    };
  }

  const { error: insertError } = await supabase
    .from("message_logs")
    .insert({ user_id: userId, message_length: messageLength });
  if (insertError) console.error("Błąd zapisu message_logs:", insertError.message);

  return { ok: true };
}

const PREVIEW_LENGTH = 200;

/**
 * Loguje wiadomość zablokowaną przez walidację inputu (patrz app/lib/input-guard.ts) do
 * message_logs, żeby panel bezpieczeństwa mógł ją wyświetlić (patrz W4_PANEL_BEZPIECZENSTWA.md).
 */
export async function logBlockedMessage(
  userId: string,
  message: string,
  reason: string,
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase.from("message_logs").insert({
    user_id: userId,
    message_length: message.length,
    blocked: true,
    block_reason: reason,
    message_preview: message.slice(0, PREVIEW_LENGTH),
  });
  if (error) console.error("Błąd zapisu zablokowanej wiadomości:", error.message);
}
