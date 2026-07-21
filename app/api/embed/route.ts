import { google } from "@ai-sdk/google";
import { embed } from "ai";

export async function POST(req: Request) {
  const { text }: { text?: string } = await req.json();

  if (!text || !text.trim()) {
    return Response.json({ error: "Brak tekstu do zaembedowania." }, { status: 400 });
  }

  try {
    const { embedding } = await embed({
      model: google.textEmbeddingModel("gemini-embedding-001"),
      value: text,
      // vector(768) w Supabase — model domyślnie zwraca 3072 wymiary, trzeba je przyciąć
      providerOptions: { google: { outputDimensionality: 768 } },
    });

    return Response.json({ embedding });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: `Nie udało się wygenerować embeddingu: ${message}` },
      { status: 500 }
    );
  }
}
