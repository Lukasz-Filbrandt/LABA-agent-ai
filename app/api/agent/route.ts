import { createChatStreamResponse } from "@/app/lib/chat-stream";
import { readWebPage, generateImage } from "@/app/lib/tools";
import { calculator } from "@/app/lib/calculator";
import { currentDateTime } from "@/app/lib/datetime";
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

const SYSTEM_PROMPT = `Jesteś agentem AI z pełnym zestawem narzędzi. Sam decydujesz, kiedy i których użyć.

## NARZĘDZIA
- google_search — wbudowane wyszukiwanie Google; użyj, gdy potrzebujesz aktualnych informacji z internetu
- readWebPage — czyta treść konkretnej strony WWW (gdy masz URL — od użytkownika albo z wyników wyszukiwania)
- generateImage — generuje obraz (logo, grafikę, ilustrację, post wizualny) na podstawie opisu
- calculator — dokładne obliczenia matematyczne; używaj zamiast liczyć w pamięci
- currentDateTime — aktualna data i godzina

## JAK DZIAŁASZ
- Rozbij złożone prośby na kroki i użyj tylu narzędzi, ile potrzeba, w logicznej kolejności
  (np. najpierw google_search, potem readWebPage na znalezionym URL, na końcu generateImage)
- Nie używaj narzędzia, jeśli pytanie tego nie wymaga
- Na końcu krótko podsumuj, co zrobiłeś, i podaj wynik

## WAŻNE — SPÓJNOŚĆ Z WŁASNYMI DZIAŁANIAMI
- Jeśli wywołałeś google_search (albo inne narzędzie), NIGDY nie twierdź potem, że nie masz
  dostępu do internetu / do tego narzędzia — to nieprawda i wprowadza w błąd
- Jeśli wyszukiwanie nie znalazło konkretnej odpowiedzi, powiedz to wprost, np.:
  "Sprawdziłem w Google, ale nie znalazłem dokładnej informacji o [temat]" —
  zamiast zaprzeczać, że w ogóle szukałeś
- Zawsze odpowiadaj na podstawie tego, co faktycznie zwróciły narzędzia, których użyłeś

## STYL
- Język: polski, rzeczowy i konkretny`;

export async function POST(req: Request) {
  const {
    messages,
    model = "flash",
  }: { messages: UIMessage[]; model?: string } = await req.json();

  return createChatStreamResponse(messages, model, SYSTEM_PROMPT, {
    enableSearch: process.env.ENABLE_SEARCH_GROUNDING === "true",
    tools: { readWebPage, generateImage, calculator, currentDateTime },
    maxSteps: 8,
  });
}
