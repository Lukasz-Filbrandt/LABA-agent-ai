import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const maxDuration = 60;

const bodySchema = z.object({
  type: z.string().min(1),
  data: z.unknown(),
});

const SYSTEM_PROMPTS: Record<string, string> = {
  feedback: `Jesteś asystentem analizującym opinie klientów. Otrzymasz dane opinii
(klient, ocena, komentarz). Zwróć zwięzłą analizę w formacie:

Sentyment: [pozytywny / neutralny / negatywny]
Priorytet: [🔴 Wysoki / 🟡 Średni / 🟢 Niski]
Sugerowana odpowiedź: [krótki draft odpowiedzi dla klienta]

Pisz wyłącznie po polsku, zwięźle, bez dodatkowych komentarzy.`,

  alert: `Jesteś asystentem SRE analizującym alerty systemowe. Otrzymasz dane alertu
(usługa, status, czas wystąpienia). Zwróć zwięzłą analizę w formacie:

Severity: [krytyczny / wysoki / średni / niski]
Zalecana akcja: [co konkretnie zrobić w reakcji na alert]

Pisz wyłącznie po polsku, zwięźle, bez dodatkowych komentarzy.`,

  order: `Jesteś asystentem potwierdzającym zamówienia. Otrzymasz dane zamówienia
(produkt, klient, kwota). Napisz krótkie podsumowanie potwierdzające zamówienie
(1-3 zdania) — co zamówiono, na jaką kwotę, i że zamówienie zostało przyjęte.

Pisz wyłącznie po polsku, zwięźle.`,
};

const FALLBACK_PROMPT = `Jesteś asystentem analizującym zdarzenia z zewnętrznych systemów.
Przeanalizuj poniższe dane zdarzenia i napisz krótkie podsumowanie (2-4 zdania) —
o co chodzi i czy wymaga to jakiejś reakcji.

Pisz wyłącznie po polsku, zwięźle.`;

function supabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  // Endpoint jest publiczny, a każde wywołanie kosztuje tokeny AI i zapisuje wiersz
  // w bazie — bez sekretu ktokolwiek mógłby go spamować.
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    return Response.json(
      { success: false, error: "WEBHOOK_SECRET nie jest skonfigurowany." },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ success: false, error: "Nieprawidłowy JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { success: false, error: 'Wymagane pola: { type: string, data: any }.' },
      { status: 400 }
    );
  }
  const { type, data } = parsed.data;

  const systemPrompt = SYSTEM_PROMPTS[type] ?? FALLBACK_PROMPT;

  const { text: analysis } = await generateText({
    model: google("gemini-3.1-flash-lite"),
    system: systemPrompt,
    prompt: `Typ zdarzenia: ${type}\nDane: ${JSON.stringify(data)}`,
  });

  const supabase = supabaseServiceClient();
  const { data: inserted, error } = await supabase
    .from("webhook_events")
    .insert({ type, data, analysis })
    .select("id")
    .single();

  if (error) {
    return Response.json(
      { success: false, error: `Błąd zapisu w Supabase: ${error.message}` },
      { status: 500 }
    );
  }

  return Response.json({ success: true, analysis, event_id: inserted.id });
}
