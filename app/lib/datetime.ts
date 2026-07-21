import { tool } from "ai";
import { z } from "zod";

export type DateTimeData = { iso: string; formatted: string; timezone: string };
export type DateTimeResult = DateTimeData | { error: string };

/**
 * Zwraca aktualną datę/godzinę sformatowaną po polsku dla danej strefy czasowej.
 * Funkcja niezależna od AI SDK — używana zarówno przez narzędzie currentDateTime,
 * jak i bezpośrednio przez /api/dashboard.
 */
export function getCurrentDateTime(timezone?: string): DateTimeResult {
  const tz = timezone || "Europe/Warsaw";
  const now = new Date();
  try {
    const formatted = new Intl.DateTimeFormat("pl-PL", {
      timeZone: tz,
      dateStyle: "full",
      timeStyle: "medium",
    }).format(now);
    return { iso: now.toISOString(), formatted, timezone: tz };
  } catch {
    return { error: `Nieprawidłowa strefa czasowa: "${tz}"` };
  }
}

export const currentDateTime = tool({
  description:
    "Zwraca aktualną datę i godzinę. Używaj, gdy użytkownik pyta o dzisiejszą datę, " +
    "dzień tygodnia, godzinę, albo potrzebujesz aktualnego czasu do obliczeń (np. dni do terminu).",
  inputSchema: z.object({
    timezone: z
      .string()
      .optional()
      .describe('Strefa czasowa IANA, np. "Europe/Warsaw" (domyślna)'),
  }),
  execute: async ({ timezone }) => getCurrentDateTime(timezone),
});
