import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { createClient } from "@supabase/supabase-js";
import { fetchWeatherData, fetchExchangeRateData } from "@/app/lib/react-tools";
import { getCurrentDateTime } from "@/app/lib/datetime";

export const maxDuration = 60;

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

/**
 * Klient z service role key — endpoint jest wywoływany przez cron (bez sesji
 * użytkownika), więc potrzebuje uprawnień do zapisu z pominięciem RLS.
 */
function supabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { success: false, error: "CRON_SECRET nie jest skonfigurowany." },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [weather, eur, usd] = await Promise.all([
    fetchWeatherData(CITY),
    fetchExchangeRateData("EUR"),
    fetchExchangeRateData("USD"),
  ]);
  const date = getCurrentDateTime();

  const dataForPrompt = `Dane wejściowe:
- Pogoda (${CITY}): ${JSON.stringify(weather)}
- Kurs EUR: ${JSON.stringify(eur)}
- Kurs USD: ${JSON.stringify(usd)}
- Data i godzina: ${JSON.stringify(date)}`;

  const { text } = await generateText({
    model: google("gemini-3.1-flash-lite"),
    system: SYSTEM_PROMPT,
    prompt: dataForPrompt,
  });

  const isoDate = new Date().toISOString().slice(0, 10);

  const supabase = supabaseServiceClient();
  const { error } = await supabase
    .from("briefings")
    .insert({ content: text, date: isoDate });

  if (error) {
    return Response.json(
      { success: false, error: `Błąd zapisu w Supabase: ${error.message}` },
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    date: isoDate,
    preview: text.slice(0, 200),
  });
}
