import { tool } from "ai";
import { z } from "zod";

const TIMEOUT_MS = 5000;

type FetchResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

/**
 * Pobiera i parsuje JSON z timeoutem 5s — współdzielone przez wszystkie narzędzia poniżej.
 * Nigdy nie rzuca — zwraca { ok:false, error } żeby narzędzia mogły zwrócić czytelny
 * komunikat zamiast crashować agenta.
 */
async function safeFetchJson<T = unknown>(
  url: string,
  timeoutMs = TIMEOUT_MS,
  headers?: Record<string, string>
): Promise<FetchResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal, headers });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `API zwróciło błąd ${response.status}. Sprawdź parametry.`,
      };
    }
    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        error: `Timeout — serwer nie odpowiedział w ${timeoutMs / 1000} sekund. Spróbuj ponownie.`,
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Błąd połączenia: ${message}` };
  } finally {
    clearTimeout(timeout);
  }
}

const WEATHER_CODES: Record<number, string> = {
  0: "bezchmurnie",
  1: "przeważnie bezchmurnie",
  2: "częściowe zachmurzenie",
  3: "pochmurno",
  45: "mgła",
  48: "mgła osadzająca szron",
  51: "mżawka słaba",
  53: "mżawka umiarkowana",
  55: "mżawka intensywna",
  61: "słaby deszcz",
  63: "umiarkowany deszcz",
  65: "silny deszcz",
  71: "słaby śnieg",
  73: "umiarkowany śnieg",
  75: "silny śnieg",
  80: "przelotne opady deszczu",
  81: "przelotne, umiarkowane opady deszczu",
  82: "gwałtowne przelotne opady deszczu",
  95: "burza",
  96: "burza z gradem",
  99: "silna burza z gradem",
};

type GeocodingResponse = {
  results?: { name: string; country: string; latitude: number; longitude: number }[];
};

type WeatherResponse = {
  current?: {
    temperature_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    relative_humidity_2m: number;
    time: string;
  };
};

export type WeatherData = {
  city: string;
  country: string;
  temperature: string;
  windSpeed: string;
  humidity: string;
  description: string;
  time: string;
};
export type WeatherResult = WeatherData | { error: string };

/**
 * Pobiera aktualną pogodę dla miasta (geokodowanie + Open-Meteo forecast).
 * Funkcja niezależna od AI SDK — używana zarówno przez narzędzie getWeather,
 * jak i bezpośrednio przez /api/dashboard (bez przechodzenia przez agenta).
 */
export async function fetchWeatherData(city: string): Promise<WeatherResult> {
  if (!city || !city.trim()) {
    return { error: "Podaj nazwę miasta" };
  }

  const geo = await safeFetchJson<GeocodingResponse>(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pl&format=json`
  );
  if (!geo.ok) return { error: geo.error };

  const place = geo.data.results?.[0];
  if (!place) {
    return { error: `Nie znalazłem miasta "${city}". Sprawdź pisownię.` };
  }

  const weather = await safeFetchJson<WeatherResponse>(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&timezone=auto`
  );
  if (!weather.ok) return { error: weather.error };

  const current = weather.data.current;
  if (!current) {
    return { error: `Brak danych pogodowych dla "${city}".` };
  }

  return {
    city: place.name,
    country: place.country,
    temperature: `${current.temperature_2m}°C`,
    windSpeed: `${current.wind_speed_10m} km/h`,
    humidity: `${current.relative_humidity_2m}%`,
    description: WEATHER_CODES[current.weather_code] ?? "nieznane warunki",
    time: current.time,
  };
}

export const getWeather = tool({
  description:
    "Zwraca aktualną pogodę dla podanego miasta (temperatura, opis warunków, wiatr). " +
    "Używaj, gdy użytkownik pyta o pogodę w konkretnym miejscu.",
  inputSchema: z.object({
    city: z.string().describe('Nazwa miasta, np. "Warszawa"'),
  }),
  execute: async ({ city }) => fetchWeatherData(city),
});

type ExchangeRateResponse = { rates?: Record<string, number>; date: string };

export type ExchangeRateData = { from: string; to: string; rate: number; date: string };
export type ExchangeRateResult = ExchangeRateData | { error: string };

/**
 * Pobiera aktualny kurs wymiany walut (Frankfurter API — dane ECB, bez klucza).
 * Funkcja niezależna od AI SDK — używana też bezpośrednio przez /api/dashboard.
 */
export async function fetchExchangeRateData(
  currency: string,
  to?: string
): Promise<ExchangeRateResult> {
  if (!/^[A-Za-z]{3}$/.test(currency)) {
    return { error: "Podaj 3-literowy kod waluty (np. EUR, USD)" };
  }
  if (to && !/^[A-Za-z]{3}$/.test(to)) {
    return { error: "Podaj 3-literowy kod waluty (np. EUR, USD)" };
  }

  const source = currency.toUpperCase();
  const target = (to || "PLN").toUpperCase();

  const result = await safeFetchJson<ExchangeRateResponse>(
    `https://api.frankfurter.app/latest?from=${source}&to=${target}`
  );
  if (!result.ok) {
    if (result.status === 404) {
      return {
        error: `Waluta ${source} nie jest obsługiwana. Popularne kody: EUR, USD, GBP, CHF`,
      };
    }
    return { error: result.error };
  }

  const rate = result.data.rates?.[target];
  if (rate == null) {
    return {
      error: `Waluta ${source} nie jest obsługiwana. Popularne kody: EUR, USD, GBP, CHF`,
    };
  }
  return { from: source, to: target, rate, date: result.data.date };
}

export const getExchangeRate = tool({
  description:
    "Zwraca aktualny kurs wymiany walut. Domyślnie przelicza na PLN. " +
    'Używaj, gdy trzeba sprawdzić kurs, np. EUR, USD, CHF.',
  inputSchema: z.object({
    currency: z.string().describe('3-literowy kod waluty źródłowej, np. "EUR", "USD", "CHF"'),
    to: z.string().optional().describe('3-literowy kod waluty docelowej (domyślnie "PLN")'),
  }),
  execute: async ({ currency, to }) => fetchExchangeRateData(currency, to),
});

type Holiday = { date: string; localName: string; name: string };

export type HolidaysData = {
  country: string;
  holidays: { date: string; name: string; englishName: string }[];
};
export type HolidaysResult = HolidaysData | { error: string };

/**
 * Pobiera święta publiczne dla kraju (Nager.Date API, bez klucza).
 * Funkcja niezależna od AI SDK — używana też bezpośrednio przez /api/dashboard.
 */
export async function fetchHolidaysData(country?: string, year?: number): Promise<HolidaysResult> {
  const code = (country || "PL").toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return { error: "Podaj 2-literowy kod kraju (np. PL, DE, US)" };
  }

  const url = year
    ? `https://date.nager.at/api/v3/PublicHolidays/${year}/${code}`
    : `https://date.nager.at/api/v3/NextPublicHolidays/${code}`;
  const result = await safeFetchJson<Holiday[]>(url);

  if (!result.ok) {
    if (result.status === 404 || result.status === 400) {
      return {
        error: `Nie znalazłem świąt dla kraju "${code}". Popularne: PL, DE, US, GB, FR`,
      };
    }
    return { error: result.error };
  }

  if (!Array.isArray(result.data) || result.data.length === 0) {
    return {
      error: `Nie znalazłem świąt dla kraju "${code}". Popularne: PL, DE, US, GB, FR`,
    };
  }

  return {
    country: code,
    holidays: result.data.map((h) => ({
      date: h.date,
      name: h.localName,
      englishName: h.name,
    })),
  };
}

export const getHolidays = tool({
  description:
    "Zwraca święta publiczne w danym kraju. Bez podania roku zwraca NAJBLIŻSZE nadchodzące " +
    'święta; z podanym rokiem — pełną listę świąt w tym roku. Kod kraju ISO, np. "PL", "DE", "US".',
  inputSchema: z.object({
    country: z.string().optional().describe('2-literowy kod kraju ISO, np. "PL" (domyślny)'),
    year: z
      .number()
      .optional()
      .describe("Rok, np. 2026 — jeśli pominięty, zwraca najbliższe nadchodzące święta"),
  }),
  execute: async ({ country, year }) => fetchHolidaysData(country, year),
});

type WikiSearchResponse = { query?: { search?: { title: string }[] } };
type WikiSummaryResponse = {
  title: string;
  extract: string;
  content_urls?: { desktop?: { page: string } };
};

export const searchWikipedia = tool({
  description:
    "Wyszukuje hasło w Wikipedii i zwraca streszczenie artykułu. Używaj do sprawdzania " +
    "definicji, faktów i biografii.",
  inputSchema: z.object({
    query: z.string().describe("Fraza do wyszukania w Wikipedii"),
    lang: z.string().optional().describe('Kod języka Wikipedii, np. "pl" (domyślny) lub "en"'),
  }),
  execute: async ({ query, lang }) => {
    if (!query || !query.trim()) {
      return { error: "Podaj frazę do wyszukania" };
    }
    const language = lang || "pl";
    // Wikipedia bez zgodnego z jej polityką User-Agent odrzuca/throttluje żądania
    // z adresów IP dostawców chmurowych (np. Vercel) kodem 429 — patrz
    // https://meta.wikimedia.org/wiki/User-Agent_policy
    const wikiHeaders = {
      "User-Agent":
        "AgentAI-Workshop/1.0 (https://github.com/Lukasz-Filbrandt/LABA-agent-ai)",
    };

    const search = await safeFetchJson<WikiSearchResponse>(
      `https://${language}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`,
      TIMEOUT_MS,
      wikiHeaders
    );
    if (!search.ok) return { error: search.error };

    const title = search.data.query?.search?.[0]?.title;
    if (!title) {
      return { error: `Nie znalazłem hasła "${query}" w Wikipedii (${language}). Sprawdź pisownię.` };
    }

    const summary = await safeFetchJson<WikiSummaryResponse>(
      `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      TIMEOUT_MS,
      wikiHeaders
    );
    if (!summary.ok) return { error: summary.error };

    return {
      title: summary.data.title,
      extract: summary.data.extract,
      url: summary.data.content_urls?.desktop?.page,
    };
  },
});

type Note = { id: number; content: string; createdAt: string };

const notes: Note[] = [];
let nextNoteId = 1;

export const saveNote = tool({
  description:
    "Zapisuje notatkę tekstową (np. wynik obliczeń, podsumowanie danych). Używaj, gdy " +
    "użytkownik prosi o zapisanie czegoś albo gdy zebrane dane warto zachować do odpowiedzi końcowej.",
  inputSchema: z.object({
    content: z.string().describe("Treść notatki do zapisania"),
  }),
  execute: async ({ content }) => {
    if (!content || !content.trim()) {
      return { error: "Podaj treść notatki do zapisania" };
    }
    const note: Note = { id: nextNoteId++, content, createdAt: new Date().toISOString() };
    notes.push(note);
    return { saved: true, id: note.id, totalNotes: notes.length };
  },
});

export const getNotes = tool({
  description:
    "Zwraca wszystkie dotąd zapisane notatki. Używaj, gdy trzeba przypomnieć sobie " +
    "wcześniej zapisane dane w ramach tej samej rozmowy.",
  inputSchema: z.object({}),
  execute: async () => {
    if (notes.length === 0) {
      return { notes: [], message: "Brak zapisanych notatek." };
    }
    return {
      notes: notes.map((n) => ({ id: n.id, content: n.content, createdAt: n.createdAt })),
    };
  },
});
