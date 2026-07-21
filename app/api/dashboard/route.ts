import { fetchWeatherData, fetchExchangeRateData } from "@/app/lib/react-tools";
import { getCurrentDateTime } from "@/app/lib/datetime";

const TIMEOUT_MS = 5000;
const DEFAULT_CITY = "Warszawa";
const DEFAULT_CURRENCIES = ["EUR", "USD"];
const MAX_CURRENCIES = 4;

/** Parsuje ?currencies=EUR,USD,GBP z URL — waliduje kody, usuwa duplikaty, limituje liczbę */
function parseCurrencies(param: string | null): string[] {
  if (!param) return DEFAULT_CURRENCIES;

  const codes = [...new Set(param.split(",").map((c) => c.trim().toUpperCase()))].filter((c) =>
    /^[A-Z]{3}$/.test(c)
  );

  return codes.length > 0 ? codes.slice(0, MAX_CURRENCIES) : DEFAULT_CURRENCIES;
}

type RateWithChange =
  | { rate: number; change: number | null; date: string }
  | { error: string };

/** Pobiera kurs sprzed ~tygodnia (Frankfurter pomija weekendy i zwraca najbliższy dzień roboczy) */
async function fetchHistoricalRate(currency: string, isoDate: string): Promise<number | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://api.frankfurter.app/${isoDate}?from=${currency}&to=PLN`,
      { signal: controller.signal }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { rates?: Record<string, number> };
    return data.rates?.PLN ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Kurs waluty do PLN + zmiana względem ~tygodnia wstecz, dla karty "Kursy walut" na dashboardzie */
async function fetchRateWithChange(currency: string): Promise<RateWithChange> {
  const latest = await fetchExchangeRateData(currency, "PLN");
  if ("error" in latest) return { error: latest.error };

  const weekAgo = new Date(latest.date);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const previousRate = await fetchHistoricalRate(currency, weekAgo.toISOString().slice(0, 10));

  return {
    rate: latest.rate,
    change: previousRate != null ? Math.round((latest.rate - previousRate) * 10000) / 10000 : null,
    date: latest.date,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requested = searchParams.get("sections");
  const sections = new Set(
    requested ? requested.split(",").map((s) => s.trim()) : ["weather", "rates", "date"]
  );
  const city = searchParams.get("city") || DEFAULT_CITY;
  const currencies = parseCurrencies(searchParams.get("currencies"));

  const [weather, rates, date] = await Promise.all([
    sections.has("weather") ? fetchWeatherData(city) : Promise.resolve(undefined),
    sections.has("rates")
      ? Promise.all(currencies.map((c) => fetchRateWithChange(c))).then((results) =>
          Object.fromEntries(currencies.map((c, i) => [c, results[i]]))
        )
      : Promise.resolve(undefined),
    sections.has("date") ? Promise.resolve(getCurrentDateTime()) : Promise.resolve(undefined),
  ]);

  return Response.json({
    fetchedAt: new Date().toISOString(),
    ...(weather !== undefined ? { weather } : {}),
    ...(rates !== undefined ? { rates } : {}),
    ...(date !== undefined ? { date } : {}),
  });
}
