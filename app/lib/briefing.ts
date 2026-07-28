import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { createClient } from "@supabase/supabase-js";
import { fetchWeatherData, fetchExchangeRateData } from "@/app/lib/react-tools";
import { getCurrentDateTime } from "@/app/lib/datetime";

const CITY = "Warszawa";

const SYSTEM_PROMPT = `Jesteś osobistym asystentem. Napisz poranny briefing w formacie:

# ☀️ Dzień dobry! Twój briefing na [data]

## 🌤️ Pogoda
[temperatura, opis, co ubrać]

## 💶 Kursy walut
- EUR: [kurs] PLN
- USD: [kurs] PLN

## 📅 Dzisiejszy dzień
- Dzień tygodnia: [...]
- Uwagi: [czy dziś święto? dzień wolny?]

## 💡 Porada dnia
[Krótka, pozytywna porada na dzień]

Pisz wyłącznie po polsku, w markdown, bez dodatkowych komentarzy przed lub po briefingu.`;

export type BriefingResult =
  | { ok: true; id: string; content: string; date: string }
  | { ok: false; error: string };

/**
 * Zbiera dane, generuje briefing przez AI i zapisuje go w tabeli briefings.
 * Funkcja niezależna od autoryzacji — wołają ją zarówno /api/cron/morning
 * (chroniony CRON_SECRET), jak i /api/briefings/generate (chroniony sesją usera).
 *
 * userId rozróżnia pochodzenie wpisu: null = cron, uuid = ręczne kliknięcie w /briefings.
 */
export async function generateAndSaveBriefing(userId?: string): Promise<BriefingResult> {
  const [weather, eur, usd] = await Promise.all([
    fetchWeatherData(CITY),
    fetchExchangeRateData("EUR"),
    fetchExchangeRateData("USD"),
  ]);
  const date = getCurrentDateTime();

  const { text } = await generateText({
    model: google("gemini-3.1-flash-lite"),
    system: SYSTEM_PROMPT,
    prompt: `Dane wejściowe:
- Pogoda (${CITY}): ${JSON.stringify(weather)}
- Kurs EUR: ${JSON.stringify(eur)}
- Kurs USD: ${JSON.stringify(usd)}
- Data i godzina: ${JSON.stringify(date)}`,
  });

  const isoDate = new Date().toISOString().slice(0, 10);

  // Service role — cron nie ma sesji użytkownika, więc zapis musi ominąć RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("briefings")
    .insert({ content: text, date: isoDate, user_id: userId ?? null })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: `Błąd zapisu w Supabase: ${error.message}` };
  }

  return { ok: true, id: String(data.id), content: text, date: isoDate };
}
