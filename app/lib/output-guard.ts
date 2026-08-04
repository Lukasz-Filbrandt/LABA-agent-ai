// Wzorce wskazujące na wyciek danych technicznych z odpowiedzi modelu — patrz lekcja_10/W2_OBRONA.md
const LEAK_PATTERNS: RegExp[] = [
  /system\s*prompt/i,
  /API[_ ]?KEY/i,
  /SUPABASE[_A-Z]*KEY/i,
  /SUPABASE_URL/i,
  /CRON_SECRET/i,
  /WEBHOOK_SECRET/i,
  /SERVICE_ROLE/i,
];

// Minimalna długość linii system promptu, którą traktujemy jako dowód dosłownego zacytowania
const MIN_LEAK_LINE_LENGTH = 25;

export const LEAK_REPLACEMENT = "Przepraszam, nie mogę udostępnić tych informacji.";

/** Czy odpowiedź zawiera dosłowny fragment system promptu (linia 25+ znaków) */
function containsSystemPromptFragment(text: string, systemPrompt: string): boolean {
  const normalized = text.replace(/\s+/g, " ").toLowerCase();
  return systemPrompt
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter((line) => line.length >= MIN_LEAK_LINE_LENGTH)
    .some((line) => normalized.includes(line.toLowerCase()));
}

/**
 * Sprawdza wygenerowaną przez LLM odpowiedź pod kątem wycieku system promptu albo danych
 * technicznych (klucze API, adresy bazy) i podmienia ją bezpiecznym komunikatem, jeśli wykryje wyciek.
 */
export function filterModelOutput(text: string, systemPrompt: string): string {
  const leaked =
    LEAK_PATTERNS.some((pattern) => pattern.test(text)) ||
    containsSystemPromptFragment(text, systemPrompt);

  return leaked ? LEAK_REPLACEMENT : text;
}
