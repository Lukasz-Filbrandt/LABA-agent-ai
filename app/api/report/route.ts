import { createChatStreamResponse } from "@/app/lib/chat-stream";
import { readWebPage } from "@/app/lib/tools";
import { calculator } from "@/app/lib/calculator";
import { currentDateTime } from "@/app/lib/datetime";
import { searchWikipedia } from "@/app/lib/react-tools";
import type { UIMessage } from "ai";

// Kilka kroków narzędzi (search + Wikipedia + strony WWW) + generowanie raportu — 60s to maksimum planu Hobby.
export const maxDuration = 60;

if (process.env.ENABLE_SEARCH_GROUNDING === "true") {
  console.warn(
    "⚠️ UWAGA: Search Grounding jest WŁĄCZONY. " +
      "To jest najdroższa funkcja API ($14/1000 zapytań). " +
      "Używaj TYLKO do testów. Wyłącz po testach usuwając ENABLE_SEARCH_GROUNDING z .env.local, " +
      "bo inni uczestnicy kursu mają wtedy ograniczony dostęp do modeli."
  );
}

const SYSTEM_PROMPT = `Jesteś profesjonalnym analitykiem biznesowym. Gdy użytkownik poda temat,
AUTONOMICZNIE zbierasz informacje i piszesz raport.

## TWÓJ PROCES:
1. Przeanalizuj temat — co trzeba zbadać?
2. Szukaj danych: google_search, searchWikipedia, readWebPage (strony branżowe)
3. Użyj currentDateTime na prawdziwą datę raportu, calculator do wszelkich obliczeń
4. Zbierz fakty, liczby, statystyki
5. Napisz raport w profesjonalnym formacie

## FORMAT RAPORTU:

# 📊 Raport: [TEMAT]
Data: [dzisiejsza data]
Autor: Agent AI

## Streszczenie (Executive Summary)
[3-4 zdania — kluczowe wnioski]

## 1. Wprowadzenie
[Kontekst, dlaczego ten temat jest ważny]

## 2. Kluczowe dane i fakty
[Wylistowane punkty z danymi — ze źródłami]

## 3. Analiza
[Interpretacja danych, trendy, porównania — jeśli temat to porównanie, użyj tabeli markdown]

## 4. Wnioski i rekomendacje
[Co z tego wynika? Co robić?]

## Źródła
[Lista użytych źródeł z linkami]

## ZASADY:
- Używaj PRAWDZIWYCH danych — google_search, searchWikipedia, readWebPage
- Podawaj źródła przy każdym fakcie
- Bądź konkretny — liczby, daty, nazwy
- Raport powinien mieć 500-1000 słów
- Nie wymyślaj statystyk — szukaj!
- Zanim napiszesz raport, wykonaj przynajmniej 2-3 wyszukiwania — nie pisz raportu bez zebrania danych
- Odpowiedz WYŁĄCZNIE gotowym raportem w formacie powyżej — bez wstępu, bez komentarzy przed lub po`;

export async function POST(req: Request) {
  const {
    messages,
    model = "flash",
  }: { messages: UIMessage[]; model?: string } = await req.json();

  return createChatStreamResponse(messages, model, SYSTEM_PROMPT, {
    enableSearch: process.env.ENABLE_SEARCH_GROUNDING === "true",
    tools: {
      calculator,
      currentDateTime,
      searchWikipedia,
      readWebPage,
    },
    maxSteps: 8,
  });
}
