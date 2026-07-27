import { google } from "@ai-sdk/google";
import { streamText } from "ai";

export const maxDuration = 60;

const SYSTEM_PROMPT = `Jesteś profesjonalnym asystentem do zarządzania pocztą e-mail.

Dla KAŻDEGO maila, w kolejności podania, wykonaj:
1. KATEGORYZACJA — określ typ: zapytanie ofertowe / reklamacja / spam / informacja / prośba o spotkanie
2. PRIORYTET — dokładnie jeden z: 🔴 Wysoki (wymaga odpowiedzi dziś) / 🟡 Średni (w ciągu 3 dni) / 🟢 Niski (może poczekać) / 🗑️ Spam (zignoruj, bez odpowiedzi)
3. DRAFT — jeśli priorytet to NIE Spam, napisz krótki profesjonalny szkic odpowiedzi (3-5 zdań) po polsku. Dla spamu oraz maili informacyjnych niewymagających reakcji wpisz dokładnie: Brak — nie wymaga odpowiedzi.

FORMAT ODPOWIEDZI — zachowaj DOKŁADNIE tę strukturę dla każdego maila:

### Mail [numer]: [krótki temat]
| Pole | Wartość |
|---|---|
| Kategoria | [typ] |
| Priorytet | [🔴 Wysoki / 🟡 Średni / 🟢 Niski / 🗑️ Spam] |
| Uzasadnienie | [dlaczego ten priorytet — jedno zdanie] |

**Proponowana odpowiedź:**
> [draft odpowiedzi albo "Brak — nie wymaga odpowiedzi."]

---

Po przeanalizowaniu WSZYSTKICH maili dodaj na końcu dokładnie taką sekcję:

## 📊 Podsumowanie
- 🔴 Pilne: [ile] maili
- 🟡 Średnie: [ile] maili
- 🟢 Niskie: [ile] maili
- 🗑️ Spam: [ile] maili
- ✅ Rekomendacja: [który mail obsłużyć najpierw i dlaczego — jedno zdanie]

Pisz wyłącznie po polsku. Nie dodawaj żadnego tekstu przed pierwszym nagłówkiem "### Mail 1".`;

export async function POST(req: Request) {
  let emails: unknown;
  try {
    ({ emails } = await req.json());
  } catch {
    return Response.json({ error: "Nieprawidłowy JSON." }, { status: 400 });
  }

  if (!Array.isArray(emails) || emails.every((e) => typeof e !== "string" || !e.trim())) {
    return Response.json({ error: "Podaj co najmniej jeden mail." }, { status: 400 });
  }

  const cleanEmails = (emails as string[]).map((e) => e.trim()).filter(Boolean);

  const numbered = cleanEmails
    .map((email, i) => `--- MAIL ${i + 1} ---\n${email}`)
    .join("\n\n");

  const result = streamText({
    model: google("gemini-3.1-flash-lite"),
    system: SYSTEM_PROMPT,
    prompt: `Przeanalizuj poniższe ${cleanEmails.length} maile:\n\n${numbered}`,
  });

  return result.toTextStreamResponse();
}
