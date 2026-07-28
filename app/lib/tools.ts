import { tool } from "ai";
import { z } from "zod";
import { generateImageFromPrompt } from "@/app/lib/image-gen";

const MAX_CHARS = 3000;
const TIMEOUT_MS = 5000;

/** Usuwa tagi <script>/<style>/<nav>/<footer> wraz z zawartością, a potem resztę znaczników HTML */
function extractTextFromHtml(html: string): string {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "");

  const withoutTags = withoutNoise.replace(/<[^>]+>/g, " ");

  return withoutTags.replace(/\s+/g, " ").trim();
}

export const readWebPage = tool({
  description:
    "Pobiera i czyta zawartość strony internetowej. Używaj gdy użytkownik poda URL " +
    "lub gdy chcesz przeczytać artykuł/stronę znalezioną w wyszukiwarce.",
  inputSchema: z.object({
    url: z.string().describe("Pełny adres URL strony do przeczytania"),
  }),
  execute: async ({ url }) => {
    if (!url || !/^https?:\/\//i.test(url)) {
      return "Błąd: podaj pełny adres URL zaczynający się od http:// lub https://.";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      // Bez identyfikującego się User-Agent wiele serwerów/CDN-ów blokuje żądania
      // z adresów IP dostawców chmurowych (np. Vercel) kodem 403/429.
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; AgentAI-Workshop/1.0; +https://github.com/Lukasz-Filbrandt/LABA-agent-ai)",
        },
      });

      if (!response.ok) {
        return `Błąd: API zwróciło błąd ${response.status}. Sprawdź adres URL.`;
      }

      const html = await response.text();
      const text = extractTextFromHtml(html);

      if (!text) {
        return "Błąd: strona nie zawiera tekstu możliwego do odczytania.";
      }

      return text.slice(0, MAX_CHARS);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return `Błąd: Timeout — serwer nie odpowiedział w ${TIMEOUT_MS / 1000} sekund. Spróbuj ponownie.`;
      }
      const message = error instanceof Error ? error.message : String(error);
      return `Błąd połączenia: ${message}`;
    } finally {
      clearTimeout(timeout);
    }
  },
});

export const generateImage = tool({
  description:
    "Generuje obraz (logo, grafikę, ilustrację, post wizualny) na podstawie opisu " +
    "tekstowego. Używaj gdy użytkownik prosi o wygenerowanie/narysowanie/stworzenie obrazu.",
  inputSchema: z.object({
    prompt: z.string().describe("Szczegółowy opis obrazu do wygenerowania"),
  }),
  execute: async ({ prompt }) => {
    try {
      const { image, text } = await generateImageFromPrompt(prompt);
      return { image, text: text ?? "" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { error: `Nie udało się wygenerować obrazu: ${message}` };
    }
  },
});
