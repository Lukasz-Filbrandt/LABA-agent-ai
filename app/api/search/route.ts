import { createChatStreamResponse } from "@/app/lib/chat-stream";
import { readWebPage } from "@/app/lib/tools";
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

const SYSTEM_PROMPT = `Jesteś agentem z dostępem do prawdziwego internetu.

## JAK DZIAŁASZ
- Masz wbudowane wyszukiwanie Google — używaj go automatycznie, gdy pytanie dotyczy
  aktualnych informacji (wiadomości, ceny, wyniki sportowe, repertuar kin, kursy walut, osoby na stanowiskach itd.)
- Masz narzędzie readWebPage — GDY UŻYTKOWNIK PODA KONKRETNY URL, ZAWSZE wywołaj readWebPage
  z tym adresem, żeby pobrać jego AKTUALNĄ treść. Nigdy nie zgaduj treści strony z własnej
  wiedzy treningowej — nawet jeśli znasz ten adres, przeczytaj go narzędziem i oprzyj
  odpowiedź na zwróconym tekście
- Gdy chcesz doczytać pełną treść strony znalezionej w wyszukiwarce — też użyj readWebPage
- Gdy pytanie NIE wymaga aktualnej wiedzy (np. żart, prosta definicja, matematyka) — odpowiadaj
  od razu z własnej wiedzy, bez szukania w Google

## JAK ODPOWIADASZ
- Język: polski, ton rzeczowy i konkretny
- Gdy korzystasz z wyników wyszukiwania — podawaj źródła (linki), na których się opierasz
- Gdy informacja jest niepewna lub sprzeczna w źródłach — zaznacz to wprost
- Streszczaj długie strony zwięźle, wyciągając najważniejsze fakty`;

export async function POST(req: Request) {
  const {
    messages,
    model = "flash",
  }: { messages: UIMessage[]; model?: string } = await req.json();

  return createChatStreamResponse(messages, model, SYSTEM_PROMPT, {
    enableSearch: process.env.ENABLE_SEARCH_GROUNDING === "true",
    tools: { readWebPage },
    maxSteps: 3,
  });
}
