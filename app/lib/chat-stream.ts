import { google } from "@ai-sdk/google";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageChunk,
  stepCountIs,
  type UIMessage,
  type UIMessageStreamWriter,
  type ToolSet,
} from "ai";
import { filterModelOutput } from "@/app/lib/output-guard";
import { logApiUsage } from "@/app/lib/token-budget";

// Wybór modelu z interfejsu — najtańszy/darmowy model dla wszystkich trybów (patrz W0_KLUCZ_API.md)
const MODEL_CHAINS: Record<string, string[]> = {
  flash: ["gemini-3.1-flash-lite"],
  pro: ["gemini-3.1-flash-lite"],
};

// Zamienia techniczny błąd na czytelny komunikat dla klienta
function toClientError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/quota|rate|429|resource_exhausted/i.test(message)) {
    return "quota: przekroczony limit darmowego planu Google AI";
  }
  if (/api[_ ]?key|permission|401|403/i.test(message)) {
    return "api key: problem z kluczem API";
  }
  return message;
}

/** Wypisuje pojedynczy statyczny komunikat tekstowy jako kompletną wiadomość asystenta */
function writeStaticText(writer: UIMessageStreamWriter, text: string): void {
  const id = crypto.randomUUID();
  writer.write({ type: "text-start", id });
  writer.write({ type: "text-delta", id, delta: text });
  writer.write({ type: "text-end", id });
}

/**
 * Zwraca gotową Response z pojedynczym statycznym komunikatem tekstowym, w formacie strumienia
 * UI message — używane, gdy odpowiedź jest blokowana PRZED wywołaniem modelu (walidacja inputu,
 * rate limiting), żeby klient dostał normalną wiadomość asystenta zamiast błędu (patrz W2_OBRONA.md).
 */
export function createStaticTextResponse(text: string): Response {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => writeStaticText(writer, text),
  });
  return createUIMessageStreamResponse({ stream });
}

export type ChatStreamOptions = {
  /** Dodatkowe narzędzia (function calling) dostępne dla modelu — WYŁĄCZONE w tym samym kroku co google_search (patrz niżej) */
  tools?: ToolSet;
  /**
   * Narzędzia dostępne w KAŻDYM kroku, także razem z google_search (np. zapisywanie profilu
   * użytkownika) — w odróżnieniu od `tools`, które przy enableSearch odblokowują się dopiero
   * od drugiego kroku. Używaj dla prostych narzędzi, które muszą zadziałać już w pierwszej
   * odpowiedzi (np. saveUserName), niezależnie od tego czy model użył wyszukiwarki.
   */
  alwaysActiveTools?: ToolSet;
  /** Włącza wbudowane wyszukiwanie Google (grounding) — model sam decyduje kiedy szukać */
  enableSearch?: boolean;
  /** Maksymalna liczba kroków (wywołanie narzędzia → wynik → ...) zanim model musi skończyć tekstem */
  maxSteps?: number;
  /**
   * Włącza filtrowanie wyjścia (patrz W2_OBRONA.md): odpowiedź jest buforowana w całości
   * (bez live-streamingu tekstu do klienta) i po zakończeniu generowania sprawdzana pod kątem
   * wycieku system promptu / danych technicznych — w razie wykrycia zastępowana bezpiecznym
   * komunikatem. Domyślnie wyłączone, żeby nie zmieniać UX pozostałych endpointów.
   */
  filterOutput?: boolean;
  /**
   * Gdy podane, po zakończeniu generowania zapisuje zużycie tokenów (z pola `totalUsage` streamu)
   * do tabeli api_usage — patrz W3_BUDZET.md / app/lib/token-budget.ts. Sprawdzenie dziennego
   * limitu robi się PRZED wywołaniem tej funkcji (patrz checkDailyBudget w route.ts).
   */
  usageLogging?: {
    userId: string;
    supabase: SupabaseClient;
    endpoint: string;
  };
};

/**
 * Streamuje odpowiedź modelu Google (z fallbackiem między modelami przy limicie)
 * jako Response gotową do zwrócenia z endpointu API czatu.
 */
export async function createChatStreamResponse(
  messages: UIMessage[],
  model: string,
  systemPrompt: string,
  options: ChatStreamOptions = {}
): Promise<Response> {
  const chain = MODEL_CHAINS[model] ?? MODEL_CHAINS.flash;
  const modelMessages = await convertToModelMessages(messages);

  const functionToolNames = options.tools ? Object.keys(options.tools) : [];
  const alwaysActiveToolNames = options.alwaysActiveTools
    ? Object.keys(options.alwaysActiveTools)
    : [];
  const hasBothToolKinds = !!options.enableSearch && functionToolNames.length > 0;

  const tools: ToolSet | undefined =
    options.enableSearch || options.tools || options.alwaysActiveTools
      ? {
          ...(options.enableSearch
            ? { google_search: google.tools.googleSearch({}) }
            : {}),
          ...(options.alwaysActiveTools ?? {}),
          ...(options.tools ?? {}),
        }
      : undefined;

  const stream = createUIMessageStream({
    onError: toClientError,
    execute: async ({ writer }) => {
      let lastError: unknown;

      async function logUsageIfNeeded(
        modelId: string,
        usage: { inputTokens?: number; outputTokens?: number } | undefined
      ): Promise<void> {
        if (!options.usageLogging || !usage) return;
        await logApiUsage({
          userId: options.usageLogging.userId,
          supabase: options.usageLogging.supabase,
          endpoint: options.usageLogging.endpoint,
          model: modelId,
          tokensInput: usage.inputTokens ?? 0,
          tokensOutput: usage.outputTokens ?? 0,
        });
      }

      for (const modelId of chain) {
        const result = streamText({
          model: google(modelId),
          system: systemPrompt,
          messages: modelMessages,
          tools,
          // Pozwala modelowi wykonać kilka kroków: wywołanie narzędzia → wynik → odpowiedź tekstowa
          stopWhen: tools ? stepCountIs(options.maxSteps ?? 3) : undefined,
          // google_search (provider-executed) i własne narzędzia funkcyjne NIE MOGĄ
          // być udostępnione w tym samym kroku — model wtedy myli konwencję wywołania
          // google_search i próbuje podać mu argumenty, których ono nie przyjmuje,
          // co kończy się błędem wykonania. Wymuszamy rozłączność: krok 0 dostaje
          // wyłącznie google_search, kolejne kroki wyłącznie narzędzia funkcyjne.
          // Instrukcje też muszą pasować do aktywnego zestawu — inaczej prompt
          // wspominający narzędzia, których nie ma w danym kroku, myli mniejsze modele.
          prepareStep: hasBothToolKinds
            ? ({ stepNumber }) =>
                stepNumber === 0
                  ? { activeTools: ["google_search", ...alwaysActiveToolNames] }
                  : {
                      activeTools: [...functionToolNames, ...alwaysActiveToolNames],
                      instructions: `${systemPrompt}\n\n(google_search już wykorzystane na tym kroku, jeśli było potrzebne — korzystaj z jego wyników)`,
                    }
            : undefined,
          // Nie ponawiaj modelu zablokowanego limitem — od razu przełącz na kolejny
          maxRetries: 0,
        });

        // Buforuj fragmenty do pierwszego tokenu tekstu. Dzięki temu, jeśli
        // model padnie na starcie (np. limit), można przełączyć się na kolejny
        // bez wysłania klientowi żadnych zdublowanych zdarzeń. Przy filterOutput
        // buforujemy całość (patrz niżej) — nic nie jest strumieniowane na żywo.
        const buffer: unknown[] = [];
        let streaming = false;
        let assistantText = "";
        let usage: { inputTokens?: number; outputTokens?: number } | undefined;

        try {
          for await (const part of result.fullStream) {
            if (part.type === "error") {
              throw part.error ?? new Error("stream error");
            }

            if (part.type === "text-delta") {
              assistantText += part.text;
            }

            if (part.type === "finish") {
              usage = part.totalUsage;
            }

            const chunk = toUIMessageChunk(part);
            if (chunk === undefined) continue;

            if (options.filterOutput) {
              // Nic nie wysyłamy na żywo — całość jest sprawdzana dopiero po zakończeniu streamu
              buffer.push(chunk);
              continue;
            }

            if (streaming) {
              writer.write(chunk);
            } else {
              buffer.push(chunk);
              if (part.type === "text-delta") {
                streaming = true;
                for (const b of buffer) writer.write(b as never);
                buffer.length = 0;
              }
            }
          }

          if (options.filterOutput) {
            const safeText = filterModelOutput(assistantText, systemPrompt);
            if (safeText !== assistantText) {
              writeStaticText(writer, safeText);
            } else {
              for (const b of buffer) writer.write(b as never);
            }
            await logUsageIfNeeded(modelId, usage);
            return; // sukces
          }

          // Odpowiedź bez tokenów tekstu, ale bez błędu — dokończ, co w buforze
          if (!streaming) for (const b of buffer) writer.write(b as never);
          await logUsageIfNeeded(modelId, usage);
          return; // sukces
        } catch (error) {
          lastError = error;
          // Jeśli już strumieniowaliśmy tekst, nie da się przełączyć modelu
          if (streaming) throw error;
          // W przeciwnym razie: odrzuć bufor i spróbuj następnego modelu
        }
      }

      throw lastError ?? new Error("Wszystkie modele zawiodły");
    },
  });

  return createUIMessageStreamResponse({ stream });
}
