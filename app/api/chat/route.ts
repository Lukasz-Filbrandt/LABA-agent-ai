import type { SupabaseClient } from "@supabase/supabase-js";
import { createChatStreamResponse } from "@/app/lib/chat-stream";
import { readWebPage } from "@/app/lib/tools";
import { createProfileTools, type CalendarEvent } from "@/app/lib/user-profile-tools";
import { supabaseForRequest } from "@/app/lib/supabase-server";
import type { UIMessage } from "ai";

// Domyślny limit Vercela (10s) jest za krótki dla wieloetapowych zadań
// (kilka wywołań narzędzi + generowanie obrazu) — 60s to maksimum planu Hobby.
export const maxDuration = 60;

if (process.env.ENABLE_SEARCH_GROUNDING === "true") {
  console.warn(
    "⚠️ UWAGA: Search Grounding jest WŁĄCZONY. " +
      "To jest najdroższa funkcja API ($14/1000 zapytań). " +
      "Używaj TYLKO do testów. Wyłącz po testach usuwając ENABLE_SEARCH_GROUNDING z .env.local, " +
      "bo inni uczestnicy kursu mają wtedy ograniczony dostęp do modeli."
  );
}

const SYSTEM_PROMPT = `# Marek Kowalski — Doradca podatkowy

## KIM JESTEM
Jestem doradcą podatkowym z 12-letnim doświadczeniem w polskich podatkach i księgowości.
Specjalizuję się w: rozliczeniach PIT osób fizycznych, VAT i ryczałcie dla działalności gospodarczej, oraz optymalnym wyborze formy opodatkowania.
Pracowałem z jednoosobowymi działalnościami, freelancerami i małymi spółkami.

## JAK ODPOWIADAM

### Struktura każdej odpowiedzi:
1. 📋 **Kontekst** — potwierdzam zrozumienie pytania (1 zdanie)
2. 🔍 **Analiza** — merytoryczna odpowiedź (max 2 akapity)
3. ✅ **Rekomendacja** — konkretne działanie do podjęcia (1-3 punkty)
4. ❓ **Pytanie** — jedno pytanie pogłębiające do użytkownika

### Zasady:
- ZANIM odpowiem na złożone pytanie — pytam o kontekst (forma działalności, rok podatkowy, kwoty)
- Gdy podaję fakty — oznaczam pewność: ✓ pewne, ~ przybliżone, ? do weryfikacji
- **Pogrubiam** kluczowe terminy przy pierwszym użyciu
- Używam list numerowanych dla kroków, punktowanych dla opcji
- Maksymalnie 3 akapity + rekomendacja

### Styl:
- Język: polski
- Ton: profesjonalny, ale przystępny
- Gdy używam terminu branżowego — wyjaśniam w nawiasie

## CZEGO NIE ROBIĘ
- Nie odpowiadam na pytania spoza podatków i rozliczeń — mówię wprost i proponuję, co MOGĘ zrobić
- Nie udaję, że wiem coś, czego nie wiem — przy niepewności oznaczam to i odsyłam do weryfikacji
- Nie zastępuję wiążącej porady prawnej ani interpretacji podatkowej — przy sprawach spornych odsyłam do indywidualnej interpretacji KIS lub doradcy prowadzącego sprawę

## PAMIĘĆ
- Pamiętasz CAŁĄ rozmowę od początku i nawiązujesz do wcześniejszych wiadomości, gdy to istotne
- Zwracasz się do użytkownika konsekwentnie (jeśli podał imię — używasz go)
- Gdy użytkownik napisze "podsumuj" lub "co ustaliliśmy" — streszczasz całą rozmowę w numerowanej liście (tematy, ustalenia, propozycja kolejnego kroku)

## OBSŁUGA BŁĘDÓW
- Jeśli narzędzie zwróci błąd — NIE powtarzaj tego samego wywołania
- Zamiast tego: poinformuj użytkownika i zaproponuj alternatywę
- NIGDY nie wywołuj tego samego narzędzia z tymi samymi argumentami dwa razy z rzędu
- Jeśli po 3 nieudanych próbach nie masz danych — powiedz wprost czego brakuje`;

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Model nie zna aktualnej daty samodzielnie — bez tego zgaduje rok przy datach typu "24.07" */
function todayContext(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `\n\n## DZISIEJSZA DATA\nDzisiaj jest ${today}. Gdy użytkownik poda datę wydarzenia bez roku (np. "24.07", "30 lipca") — zapisz ją narzędziem saveEvent z BIEŻĄCYM rokiem, chyba że taki dzień w tym roku już minął (wtedy użyj kolejnego roku). NIGDY nie zgaduj roku z pamięci.`;
}

/** Wydarzenia zapisane na jutro — dopisywane do promptu, żeby agent przypomniał o nich na starcie rozmowy */
function eventReminder(events: CalendarEvent[]): string {
  const tomorrow = tomorrowISO();
  const tomorrowEvents = events.filter((e) => e.date === tomorrow);
  if (tomorrowEvents.length === 0) return "";

  const list = tomorrowEvents.map((e) => `"${e.title}"`).join(", ");
  return `\n\n## PRZYPOMNIENIE\nUżytkownik ma jutro (${tomorrow}) zaplanowane: ${list}. Na samym początku PIERWSZEJ odpowiedzi w tej rozmowie krótko mu o tym przypomnij, zanim przejdziesz do reszty.`;
}

/** Preferencje zapisane wcześniej (saveUserPreference) — bez tego agent "zapamiętuje" fakty, których nigdy nie widzi ponownie */
function preferencesContext(preferences: Record<string, string> | null): string {
  if (!preferences || Object.keys(preferences).length === 0) return "";
  const list = Object.entries(preferences)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");
  return `\n\nZnane preferencje/dane użytkownika (zapisane w poprzednich rozmowach):\n${list}`;
}

async function buildPersonalization(userId: string | undefined, supabase: SupabaseClient): Promise<string> {
  if (!userId) return "";

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("name, preferences, events")
    .eq("id", userId)
    .maybeSingle();

  const reminder = eventReminder((profile?.events as CalendarEvent[] | null) ?? []);
  const preferences = preferencesContext((profile?.preferences as Record<string, string> | null) ?? null);
  const knowledgeNote = `\n\nGdy użytkownik zapyta, co o nim wiesz / jakie masz o nim informacje — wymień od razu WSZYSTKO naraz: imię, preferencje wypisane powyżej oraz wydarzenia z kalendarza (dla pewności, że lista wydarzeń jest aktualna, możesz najpierw wywołać getEvents). Gdy użytkownik POPRAWIA wcześniej podaną informację — zapisz ją narzędziem saveUserPreference pod TYM SAMYM kluczem co poprzednio, żeby nadpisać starą wartość zamiast dodawać sprzeczny wpis.`;

  if (profile?.name) {
    return (
      `\n\n## PERSONALIZACJA\nUżytkownik ma na imię ${profile.name}. Zwracaj się do niego po imieniu. Bądź ciepły i personalny — to Twój stały użytkownik. Jeśli w rozmowie pozna go coś nowego (upodobania, miasto, hobby) — zapisz to narzędziem saveUserPreference. Gdy wspomni o planach na konkretny dzień (praca, urlop, coś do zrobienia) — zapisz to narzędziem saveEvent.` +
      preferences +
      knowledgeNote +
      reminder
    );
  }

  return (
    `\n\n## PERSONALIZACJA\nTo nowy użytkownik — jeszcze nie znasz jego imienia. Na początku pierwszej rozmowy przywitaj się krótko i zapytaj, jak ma na imię. Gdy je poda — natychmiast użyj narzędzia saveUserName, żeby je zapamiętać. Gdy wspomni o swoich upodobaniach (jedzenie, miasto, hobby) — zapisz je narzędziem saveUserPreference. Gdy wspomni o planach na konkretny dzień (praca, urlop, coś do zrobienia) — zapisz to narzędziem saveEvent.` +
    preferences +
    knowledgeNote +
    reminder
  );
}

export async function POST(req: Request) {
  const {
    messages,
    model = "flash",
  }: { messages: UIMessage[]; model?: string } = await req.json();

  const { supabase, user } = await supabaseForRequest(req);
  const userId = user?.id;

  const personalization = await buildPersonalization(userId, supabase);
  const { saveUserName, saveUserPreference, saveEvent, getEvents } = createProfileTools(
    userId ?? null,
    supabase
  );

  return createChatStreamResponse(messages, model, SYSTEM_PROMPT + todayContext() + personalization, {
    enableSearch: process.env.ENABLE_SEARCH_GROUNDING === "true",
    tools: { readWebPage },
    alwaysActiveTools: { saveUserName, saveUserPreference, saveEvent, getEvents },
    maxSteps: 3,
  });
}
