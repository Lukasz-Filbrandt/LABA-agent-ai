"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { useUserProfile } from "@/app/lib/use-user-profile";
import type { CalendarEvent } from "@/app/lib/user-profile-tools";

type WeatherData = {
  city: string;
  country: string;
  temperature: string;
  windSpeed: string;
  humidity: string;
  description: string;
  time: string;
};
type Rate = { rate: number; change: number | null; date: string } | { error: string };
type DateData = { iso: string; formatted: string; timezone: string };

type DashboardData = {
  weather?: WeatherData | { error: string };
  rates?: Record<string, Rate>;
  date?: DateData | { error: string };
};

type SectionKey = "weather" | "rates" | "date";

const WEATHER_REFRESH_MS = 15 * 60 * 1000;
const RATES_REFRESH_MS = 60 * 60 * 1000;

const DEFAULT_CITY = "Warszawa";
const CITY_PRESETS = ["Warszawa", "Gdańsk", "Gdynia", "Oslo"];
const CITY_STORAGE_KEY = "dashboard_city";

const DEFAULT_CURRENCIES = ["EUR", "USD"];
const CURRENCY_PRESETS = ["EUR", "USD", "GBP", "CHF", "NOK"];
const MAX_SELECTED_CURRENCIES = 4;
const CURRENCIES_STORAGE_KEY = "dashboard_currencies";

const QUICK_ACTIONS = [
  { emoji: "🌍", label: "Zaplanuj podróż", href: "/travel" },
  {
    emoji: "📊",
    label: "Porównaj waluty",
    href: `/react?q=${encodeURIComponent("Porównaj kursy EUR, USD, GBP, CHF")}`,
  },
  { emoji: "🔄", label: "Agent ReAct", href: "/react" },
  { emoji: "💬", label: "Chat z agentem", href: "/chat" },
  { emoji: "🧠", label: "Tryb myślenia", href: "/think" },
  { emoji: "📖", label: "Słownik AI", href: "/fewshot" },
];

function greeting(): { emoji: string; text: string } {
  const hour = new Date().getHours();
  if (hour < 6) return { emoji: "🌙", text: "Dobranoc" };
  if (hour < 18) return { emoji: "🌅", text: "Dzień dobry" };
  return { emoji: "🌇", text: "Dobry wieczór" };
}

function weatherEmoji(description: string): string {
  if (description.includes("burza")) return "⛈️";
  if (description.includes("śnieg")) return "❄️";
  if (description.includes("deszcz") || description.includes("mżawka")) return "🌧️";
  if (description.includes("mgła")) return "🌫️";
  if (description.includes("pochmurno") || description.includes("zachmurzenie")) return "☁️";
  return "☀️";
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function formatShortDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="dash-skel"
          style={{ height: i === 0 ? 28 : 14, width: i === 0 ? "60%" : `${90 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

function DashCard({
  title,
  icon,
  variant,
  updatedAt,
  delay,
  children,
}: {
  title: string;
  icon: string;
  variant: "weather" | "rates" | "calendar" | "actions";
  updatedAt?: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <div className={`dash-card dash-card--${variant}`} style={{ animationDelay: `${delay}ms` }}>
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          letterSpacing: 0.6,
          opacity: 0.85,
          marginBottom: 14,
        }}
      >
        {icon} {title}
      </div>
      {children}
      {updatedAt && (
        <div style={{ marginTop: 14, fontSize: 11, opacity: 0.6 }}>
          Ostatnia aktualizacja: {formatClock(updatedAt)}
        </div>
      )}
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return <div style={{ fontSize: 13, color: "#fca5a5" }}>⚠️ {message}</div>;
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontFamily: "inherit",
        fontWeight: active ? 600 : 400,
        border: `1px solid ${active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.15)"}`,
        background: active ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.06)",
        color: "#f1f5f9",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function WeatherCard({
  weather,
  loading,
  updatedAt,
  delay,
  city,
  onSelectCity,
}: {
  weather?: WeatherData | { error: string };
  loading: boolean;
  updatedAt?: string;
  delay: number;
  city: string;
  onSelectCity: (city: string) => void;
}) {
  const [customCity, setCustomCity] = useState("");

  const submitCustomCity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCity.trim()) return;
    onSelectCity(customCity.trim());
    setCustomCity("");
  };

  return (
    <DashCard title="POGODA" icon="🌤️" variant="weather" updatedAt={updatedAt} delay={delay}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {CITY_PRESETS.map((c) => (
          <Pill key={c} active={c === city} onClick={() => onSelectCity(c)}>
            {c}
          </Pill>
        ))}
      </div>
      <form onSubmit={submitCustomCity} style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <input
          value={customCity}
          onChange={(e) => setCustomCity(e.target.value)}
          placeholder="Inne miasto..."
          style={{
            flex: 1,
            padding: "5px 10px",
            borderRadius: 8,
            fontSize: 12,
            fontFamily: "inherit",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "#f1f5f9",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "5px 10px",
            borderRadius: 8,
            fontSize: 12,
            fontFamily: "inherit",
            background: "rgba(255,255,255,0.14)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "#f1f5f9",
            cursor: "pointer",
          }}
        >
          Szukaj
        </button>
      </form>
      {!weather && loading ? (
        <Skeleton lines={4} />
      ) : !weather ? null : "error" in weather ? (
        <ErrorLine message={weather.error} />
      ) : (
        <>
          <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
            {weather.city}, {weather.country}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 34 }}>{weatherEmoji(weather.description)}</span>
            <span style={{ fontSize: 32, fontWeight: 700 }}>{weather.temperature}</span>
          </div>
          <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85, textTransform: "capitalize" }}>
            {weather.description}
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 12.5,
              opacity: 0.75,
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            <span>Wiatr: {weather.windSpeed}</span>
            <span>Wilgotność: {weather.humidity}</span>
          </div>
        </>
      )}
    </DashCard>
  );
}

function RatesCard({
  rates,
  loading,
  updatedAt,
  delay,
  selectedCurrencies,
  onToggleCurrency,
}: {
  rates?: Record<string, Rate>;
  loading: boolean;
  updatedAt?: string;
  delay: number;
  selectedCurrencies: string[];
  onToggleCurrency: (code: string) => void;
}) {
  const entries = rates ? Object.entries(rates) : [];
  const firstOk = entries.map(([, r]) => r).find((r) => !("error" in r)) as
    | { rate: number; change: number | null; date: string }
    | undefined;

  return (
    <DashCard title="KURSY WALUT" icon="💶" variant="rates" updatedAt={updatedAt} delay={delay}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {CURRENCY_PRESETS.map((code) => (
          <Pill
            key={code}
            active={selectedCurrencies.includes(code)}
            onClick={() => onToggleCurrency(code)}
          >
            {code}
          </Pill>
        ))}
      </div>
      {!rates && loading ? (
        <Skeleton lines={3} />
      ) : !rates ? null : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {entries.map(([code, r]) =>
              "error" in r ? (
                <ErrorLine key={code} message={`${code}: ${r.error}`} />
              ) : (
                <div key={code} style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}>
                  <span>
                    {code}: <strong>{r.rate.toFixed(4)}</strong> PLN
                  </span>
                  {r.change != null && (
                    <span
                      style={{
                        color: r.change >= 0 ? "#4ade80" : "#f87171",
                        fontSize: 13,
                      }}
                    >
                      {r.change >= 0 ? "↑" : "↓"} {Math.abs(r.change).toFixed(4)}
                    </span>
                  )}
                </div>
              )
            )}
          </div>
          {firstOk && (
            <div style={{ marginTop: 12, fontSize: 11.5, opacity: 0.65 }}>
              Kurs z: {firstOk.date} (ECB)
            </div>
          )}
        </>
      )}
    </DashCard>
  );
}

const fieldStyle: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 8,
  fontSize: 12,
  fontFamily: "inherit",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "#f1f5f9",
};

function CalendarCard({
  events,
  loading,
  delay,
  onAdd,
  onRemove,
}: {
  events: CalendarEvent[] | null;
  loading: boolean;
  delay: number;
  onAdd: (date: string, title: string) => void;
  onRemove: (id: string) => void;
}) {
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !title.trim()) return;
    onAdd(date, title.trim());
    setTitle("");
  };

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (events ?? [])
    .filter((ev) => ev.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <DashCard title="KALENDARZ" icon="🗓️" variant="calendar" delay={delay}>
      <form onSubmit={submit} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ ...fieldStyle, flex: "1 1 130px" }}
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Praca, urlop, coś do zrobienia..."
          style={{ ...fieldStyle, flex: "2 1 150px" }}
        />
        <button
          type="submit"
          style={{
            padding: "5px 10px",
            borderRadius: 8,
            fontSize: 12,
            fontFamily: "inherit",
            background: "rgba(255,255,255,0.14)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "#f1f5f9",
            cursor: "pointer",
          }}
        >
          Dodaj
        </button>
      </form>
      {!events && loading ? (
        <Skeleton lines={4} />
      ) : upcoming.length === 0 ? (
        <div style={{ fontSize: 13, opacity: 0.7 }}>Brak zaplanowanych wydarzeń.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {upcoming.map((ev) => (
            <div
              key={ev.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                fontSize: 13.5,
              }}
            >
              <span>
                {formatShortDate(ev.date)} — {ev.title}
                {ev.date === today ? " (dziś)" : ""}
              </span>
              <button
                type="button"
                onClick={() => onRemove(ev.id)}
                aria-label="Usuń wydarzenie"
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  opacity: 0.55,
                  cursor: "pointer",
                  fontSize: 13,
                  padding: 2,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </DashCard>
  );
}

function QuickActionsCard({ delay }: { delay: number }) {
  return (
    <DashCard title="SZYBKIE AKCJE" icon="🤖" variant="actions" delay={delay}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {QUICK_ACTIONS.map((a) => (
          <Link key={a.label} href={a.href} className="dash-action-link">
            {a.emoji} {a.label}
          </Link>
        ))}
      </div>
    </DashCard>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({});
  const [updatedAt, setUpdatedAt] = useState<Partial<Record<SectionKey, string>>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [city, setCityState] = useState(DEFAULT_CITY);
  const [currencies, setCurrenciesState] = useState<string[]>(DEFAULT_CURRENCIES);
  // Mirrory stanu — dają fetchSections/timerom dostęp do aktualnej wartości bez stale closures
  const cityRef = useRef(city);
  const currenciesRef = useRef(currencies);
  // Numer ostatniego żądania per sekcja — przy szybkich kolejnych zmianach (np. dwa kliknięcia
  // w chipy walut) odpowiedzi mogą wrócić w innej kolejności niż zostały wysłane; bez tego
  // starsza odpowiedź potrafiłaby nadpisać nowszą.
  const requestCounterRef = useRef(0);
  const latestRequestRef = useRef<Partial<Record<SectionKey, number>>>({});

  const fetchSections = useCallback(async (sections: SectionKey[]) => {
    const requestId = ++requestCounterRef.current;
    for (const s of sections) latestRequestRef.current[s] = requestId;

    const params = new URLSearchParams({ sections: sections.join(",") });
    if (sections.includes("weather")) params.set("city", cityRef.current);
    if (sections.includes("rates")) params.set("currencies", currenciesRef.current.join(","));

    const res = await fetch(`/api/dashboard?${params.toString()}`);
    const json = (await res.json()) as DashboardData;

    const freshSections = sections.filter((s) => latestRequestRef.current[s] === requestId);
    if (freshSections.length === 0) return;

    const now = new Date().toISOString();
    setData((prev) => {
      const next: Partial<Record<SectionKey, unknown>> = { ...prev };
      for (const s of freshSections) next[s] = json[s];
      return next as DashboardData;
    });
    setUpdatedAt((prev) => {
      const next = { ...prev };
      for (const s of freshSections) next[s] = now;
      return next;
    });
  }, []);

  const loadAll = useCallback(async () => {
    await fetchSections(["weather", "rates", "date"]);
    setLoading(false);
  }, [fetchSections]);

  // Kalendarz — powiązany z tym samym user_profiles.id co spersonalizowany czat (patrz use-user-profile.ts),
  // więc wydarzenia dodane tu i przez chatbota (narzędzie saveEvent) współdzielą ten sam profil.
  const { loadProfile, getUserId } = useUserProfile(true);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [eventsLoading, setEventsLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    await loadProfile();
    const userId = getUserId();
    if (!userId) {
      setEventsLoading(false);
      return;
    }
    const { data } = await supabase
      .from("user_profiles")
      .select("events")
      .eq("id", userId)
      .maybeSingle();
    setEvents((data?.events as CalendarEvent[] | null) ?? []);
    setEventsLoading(false);
  }, [loadProfile, getUserId]);

  const addEvent = useCallback(
    async (date: string, title: string) => {
      const userId = getUserId();
      if (!userId) return;
      const next = [...(events ?? []), { id: crypto.randomUUID(), date, title }];
      setEvents(next);
      await supabase.from("user_profiles").update({ events: next }).eq("id", userId);
    },
    [events, getUserId]
  );

  const removeEvent = useCallback(
    async (id: string) => {
      const userId = getUserId();
      if (!userId) return;
      const next = (events ?? []).filter((e) => e.id !== id);
      setEvents(next);
      await supabase.from("user_profiles").update({ events: next }).eq("id", userId);
    },
    [events, getUserId]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const selectCity = useCallback(
    (next: string) => {
      if (next === cityRef.current) return;
      cityRef.current = next;
      setCityState(next);
      localStorage.setItem(CITY_STORAGE_KEY, next);
      void fetchSections(["weather"]);
    },
    [fetchSections]
  );

  const toggleCurrency = useCallback(
    (code: string) => {
      const prev = currenciesRef.current;
      const next = prev.includes(code)
        ? prev.filter((c) => c !== code)
        : prev.length >= MAX_SELECTED_CURRENCIES
          ? prev
          : [...prev, code];
      if (next === prev || next.length === 0) return;

      currenciesRef.current = next;
      setCurrenciesState(next);
      localStorage.setItem(CURRENCIES_STORAGE_KEY, JSON.stringify(next));
      void fetchSections(["rates"]);
    },
    [fetchSections]
  );

  useEffect(() => {
    // Wczytaj zapisane wcześniej miasto/waluty PRZED pierwszym fetchem (ref, nie state — synchronicznie)
    const savedCity = localStorage.getItem(CITY_STORAGE_KEY);
    if (savedCity) {
      cityRef.current = savedCity;
      setCityState(savedCity);
    }
    const savedCurrenciesRaw = localStorage.getItem(CURRENCIES_STORAGE_KEY);
    if (savedCurrenciesRaw) {
      try {
        const parsed = JSON.parse(savedCurrenciesRaw) as unknown;
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((c) => typeof c === "string")) {
          currenciesRef.current = parsed;
          setCurrenciesState(parsed);
        }
      } catch {
        // ignoruj uszkodzony zapis — zostają wartości domyślne
      }
    }

    loadAll();
    void loadEvents();
    const weatherTimer = setInterval(() => fetchSections(["weather"]), WEATHER_REFRESH_MS);
    const ratesTimer = setInterval(() => fetchSections(["rates"]), RATES_REFRESH_MS);
    return () => {
      clearInterval(weatherTimer);
      clearInterval(ratesTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAll, fetchSections]);

  const { emoji: greetEmoji, text: greetText } = greeting();
  const dateData = data.date && !("error" in data.date) ? data.date : undefined;
  const todayLabel = dateData
    ? new Date(dateData.iso).toLocaleDateString("pl-PL", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <main className="dash-shell">
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 28,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <h1 style={{ fontSize: 21, fontWeight: 700, color: "#f1f5f9" }}>
            {greetEmoji} {greetText}!{todayLabel ? ` Dziś: ${todayLabel}` : ""}
          </h1>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="dash-refresh-btn"
            title="Odśwież dane"
            aria-label="Odśwież dane"
          >
            <span
              style={{
                display: "inline-block",
                animation: refreshing ? "dash-spin 0.8s linear infinite" : "none",
              }}
            >
              🔄
            </span>
          </button>
        </header>

        <div className="dash-grid">
          <WeatherCard
            weather={data.weather}
            loading={loading}
            updatedAt={updatedAt.weather}
            delay={0}
            city={city}
            onSelectCity={selectCity}
          />
          <RatesCard
            rates={data.rates}
            loading={loading}
            updatedAt={updatedAt.rates}
            delay={80}
            selectedCurrencies={currencies}
            onToggleCurrency={toggleCurrency}
          />
          <CalendarCard
            events={events}
            loading={eventsLoading}
            delay={160}
            onAdd={addEvent}
            onRemove={removeEvent}
          />
          <QuickActionsCard delay={240} />
        </div>
      </div>
    </main>
  );
}
