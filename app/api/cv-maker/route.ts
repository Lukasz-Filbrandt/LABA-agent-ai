import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { cvSchema, sanitizeCV } from "@/app/lib/cv-schema";

export const maxDuration = 60;

const SYSTEM_PROMPT = `Jesteś ekspertem HR i profesjonalnym copywriterem CV. Na podstawie surowych
notatek podanych przez użytkownika tworzysz dobrze sformatowane, zwięzłe dane do profesjonalnego CV
po polsku, dopasowane do wskazanej branży docelowej.

ZASADY:
- NIGDY nie używaj długiego myślnika "—" (em dash) w żadnym tekście. Zamiast niego używaj przecinka,
  kropki, dwukropka albo zwykłego łącznika "-" ze spacjami. To zasada twarda, bez wyjątków.
- NIE zmyślaj faktów (dat, nazw firm, szkół, liczb) których użytkownik nie podał — jeśli czegoś
  brakuje, pomiń pole zamiast wymyślać
- Profil zawodowy (summary) i tytuł stanowiska (jobTitle) DOPASUJ do wskazanej branży docelowej —
  dobierz słownictwo i akcenty tak, jakby CV miało trafić do rekrutera z tej branży
- Doświadczenie zawodowe przekształć na klarowne punkty (bullets), każdy zaczynający się od
  czasownika dokonanego (np. "Wdrożyłem", "Zwiększyłem", "Koordynowałem"), z konkretami jeśli
  użytkownik je podał
- Umiejętności i zainteresowania: pojedyncze, krótkie, konkretne hasła (nie całe zdania)
- Dane kontaktowe (email, telefon, lokalizacja, LinkedIn, strona) wyciągnij z pola "Dane osobowe" —
  jeśli czegoś tam nie ma, zostaw puste
- Zachowaj rzeczowy, zwięzły, profesjonalny ton — bez zbędnego lania wody`;

function buildInitialPrompt(fields: Record<string, string>): string {
  return `Stwórz dane CV na podstawie poniższych notatek użytkownika:

## Dane osobowe
${fields.personalData || "(brak)"}

## Zainteresowania
${fields.interests || "(brak)"}

## Umiejętności
${fields.skills || "(brak)"}

## Znajomość języków
${fields.languages || "(brak)"}

## Edukacja
${fields.education || "(brak)"}

## Doświadczenie zawodowe
${fields.experience || "(brak)"}

## Branża docelowa
${fields.industry || "(brak — dobierz ton uniwersalny)"}`;
}

export async function POST(req: Request) {
  let body: {
    mode?: "generate" | "edit";
    fields?: Record<string, string>;
    currentCV?: unknown;
    editInstruction?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Nieprawidłowy JSON." }, { status: 400 });
  }

  const prompt =
    body.mode === "edit"
      ? `Oto aktualne dane CV w formacie JSON:\n${JSON.stringify(body.currentCV, null, 2)}\n\n` +
        `Użytkownik prosi o następującą zmianę:\n"${body.editInstruction}"\n\n` +
        `Zastosuj TYLKO tę zmianę (i wszystko co z niej logicznie wynika), zachowaj resztę danych ` +
        `bez zmian, i zwróć PEŁNY zaktualizowany obiekt CV w tym samym schemacie.`
      : buildInitialPrompt(body.fields ?? {});

  try {
    const { object } = await generateObject({
      model: google("gemini-3.1-flash-lite"),
      schema: cvSchema,
      system: SYSTEM_PROMPT,
      prompt,
    });

    return Response.json({ cv: sanitizeCV(object) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: `Nie udało się wygenerować CV: ${message}` }, { status: 500 });
  }
}
