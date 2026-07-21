import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CalendarEvent = { id: string; date: string; title: string };

/**
 * Narzędzia pozwalające agentowi zapamiętać dane o użytkowniku w user_profiles (patrz W3_IMIE.md).
 * `supabase` musi być klientem autoryzowanym tokenem tego usera (patrz W3_LOGIN_PRYWATNOSC.md /
 * app/lib/supabase-server.ts) — inaczej RLS zablokuje odczyt/zapis.
 */
export function createProfileTools(userId: string | null, supabase: SupabaseClient) {
  // Agent potrafi wywołać kilka narzędzi zapisujących w JEDNYM kroku (np. saveUserPreference dwa
  // razy naraz dla różnych kluczy) — AI SDK wykonuje takie wywołania równolegle. Bez serializacji
  // każde z nich odczytuje ten sam stan PRZED zapisem drugiego, więc drugi zapis nadpisuje pierwszy
  // (utracona preferencja). Kolejka żyje tylko w obrębie tego jednego requestu — createProfileTools
  // jest wywoływane od nowa dla każdego POST-a — więc wymusza kolejność zapisów bez dotykania bazy.
  let writeQueue: Promise<unknown> = Promise.resolve();
  function serialized<T>(fn: () => Promise<T>): Promise<T> {
    const result = writeQueue.then(fn, fn);
    writeQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  const saveUserName = tool({
    description:
      "Zapisuje imię użytkownika w jego profilu. Wywołaj to natychmiast, gdy użytkownik poda swoje imię.",
    inputSchema: z.object({
      name: z.string().describe("Imię użytkownika, np. 'Paweł'"),
    }),
    execute: async ({ name }) =>
      serialized(async () => {
        if (!userId) return "Błąd: nie znam identyfikatora użytkownika.";
        const { error } = await supabase
          .from("user_profiles")
          .update({ name })
          .eq("id", userId);
        if (error) return `Błąd zapisu imienia: ${error.message}`;
        return `Zapisano imię użytkownika: ${name}`;
      }),
  });

  const saveUserPreference = tool({
    description:
      "Zapisuje preferencję użytkownika (np. ulubione jedzenie, miasto, hobby) w jego profilu. " +
      "Wywołaj gdy użytkownik wspomni o czymś, co warto zapamiętać na przyszłość.",
    inputSchema: z.object({
      key: z.string().describe("Klucz preferencji, np. 'ulubione_jedzenie', 'miasto', 'hobby'"),
      value: z.string().describe("Wartość preferencji, np. 'pizza', 'Kraków'"),
    }),
    execute: async ({ key, value }) =>
      serialized(async () => {
        if (!userId) return "Błąd: nie znam identyfikatora użytkownika.";
        const { data: existing, error: fetchError } = await supabase
          .from("user_profiles")
          .select("preferences")
          .eq("id", userId)
          .single();
        if (fetchError) return `Błąd odczytu preferencji: ${fetchError.message}`;

        const preferences = { ...(existing?.preferences ?? {}), [key]: value };
        const { error } = await supabase
          .from("user_profiles")
          .update({ preferences })
          .eq("id", userId);
        if (error) return `Błąd zapisu preferencji: ${error.message}`;
        return `Zapisano preferencję: ${key} = ${value}`;
      }),
  });

  const saveEvent = tool({
    description:
      "Zapisuje wydarzenie w kalendarzu użytkownika na konkretny dzień (np. praca, urlop, spotkanie, " +
      "coś do zrobienia). Wywołaj, gdy użytkownik poprosi o dodanie czegoś do kalendarza albo wspomni " +
      "o swoich planach na konkretną datę.",
    inputSchema: z.object({
      date: z.string().describe("Data wydarzenia w formacie YYYY-MM-DD"),
      title: z.string().describe("Krótki opis wydarzenia, np. 'Urlop', 'Spotkanie z klientem'"),
    }),
    execute: async ({ date, title }) =>
      serialized(async () => {
        if (!userId) return "Błąd: nie znam identyfikatora użytkownika.";
        const { data: existing, error: fetchError } = await supabase
          .from("user_profiles")
          .select("events")
          .eq("id", userId)
          .single();
        if (fetchError) return `Błąd odczytu kalendarza: ${fetchError.message}`;

        const events: CalendarEvent[] = [
          ...((existing?.events as CalendarEvent[] | null) ?? []),
          { id: crypto.randomUUID(), date, title },
        ];
        const { error } = await supabase.from("user_profiles").update({ events }).eq("id", userId);
        if (error) return `Błąd zapisu wydarzenia: ${error.message}`;
        return `Zapisano w kalendarzu: ${date} — ${title}`;
      }),
  });

  const getEvents = tool({
    description:
      "Zwraca listę wydarzeń zapisanych w kalendarzu użytkownika. Wywołaj, gdy użytkownik pyta, " +
      "co ma zaplanowane albo co zapisał w kalendarzu.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!userId) return "Błąd: nie znam identyfikatora użytkownika.";
      const { data, error } = await supabase
        .from("user_profiles")
        .select("events")
        .eq("id", userId)
        .single();
      if (error) return `Błąd odczytu kalendarza: ${error.message}`;

      const events = ((data?.events as CalendarEvent[] | null) ?? [])
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date));
      if (events.length === 0) return "Kalendarz jest pusty.";
      return events.map((e) => `${e.date} — ${e.title}`).join("\n");
    },
  });

  return { saveUserName, saveUserPreference, saveEvent, getEvents };
}
