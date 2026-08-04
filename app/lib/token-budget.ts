import type { SupabaseClient } from "@supabase/supabase-js";

const DAILY_TOKEN_LIMIT = 10000;

export type BudgetCheckResult = { ok: true } | { ok: false; message: string };

function startOfTodayISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/**
 * Sprawdza dzienny budżet tokenów per user (tabela api_usage, patrz supabase/w3_api_usage.sql).
 * `supabase` musi być klientem autoryzowanym tokenem tego usera — inaczej RLS zablokuje odczyt
 * (patrz app/lib/supabase-server.ts). Wywołuj PRZED każdym wywołaniem LLM.
 */
export async function checkDailyBudget(
  userId: string,
  supabase: SupabaseClient
): Promise<BudgetCheckResult> {
  const since = startOfTodayISO();

  const { data, error } = await supabase
    .from("api_usage")
    .select("tokens_input, tokens_output")
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) {
    // Fail-open: błąd bazy (np. brak tabeli przed uruchomieniem migracji) nie powinien
    // blokować całego czatu — logujemy i wpuszczamy wiadomość.
    console.error("Błąd odczytu api_usage (limit budżetu pominięty):", error.message);
    return { ok: true };
  }

  const usedToday = (data ?? []).reduce(
    (sum, row) => sum + (row.tokens_input ?? 0) + (row.tokens_output ?? 0),
    0
  );

  if (usedToday >= DAILY_TOKEN_LIMIT) {
    return {
      ok: false,
      message: "Dzienny limit tokenów (10k) został wyczerpany. Wróć jutro!",
    };
  }

  return { ok: true };
}

export type LogUsageParams = {
  userId: string;
  supabase: SupabaseClient;
  model: string;
  endpoint: string;
  tokensInput: number;
  tokensOutput: number;
};

/** Loguje zużycie tokenów pojedynczego wywołania LLM do api_usage. Wywołuj PO KAŻDYM wywołaniu LLM. */
export async function logApiUsage({
  userId,
  supabase,
  model,
  endpoint,
  tokensInput,
  tokensOutput,
}: LogUsageParams): Promise<void> {
  const { error } = await supabase.from("api_usage").insert({
    user_id: userId,
    tokens_input: tokensInput,
    tokens_output: tokensOutput,
    model,
    endpoint,
  });
  if (error) console.error("Błąd zapisu api_usage:", error.message);
}
