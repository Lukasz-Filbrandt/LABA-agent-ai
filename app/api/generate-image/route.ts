import { generateImageFromPrompt } from "@/app/lib/image-gen";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { prompt }: { prompt?: string } = await req.json();

  if (!prompt || !prompt.trim()) {
    return Response.json({ error: "Brak opisu obrazu (prompt)." }, { status: 400 });
  }

  try {
    const { image, text } = await generateImageFromPrompt(prompt);
    return Response.json({ image, text });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: `Nie udało się wygenerować obrazu: ${message}` },
      { status: 500 }
    );
  }
}
