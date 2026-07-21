import { google } from "@ai-sdk/google";
import { generateText } from "ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  const {
    image,
    instruction,
  }: { image?: string; instruction?: string } = await req.json();

  if (!image) {
    return Response.json({ error: "Brak obrazu." }, { status: 400 });
  }

  try {
    const { text } = await generateText({
      model: google("gemini-3.1-flash-lite"),
      messages: [
        {
          role: "user",
          content: [
            { type: "file", mediaType: "image/*", data: new URL(image) },
            {
              type: "text",
              text: `Opisz ten obraz szczegółowo (kompozycja, obiekty, kolory, styl), tak aby na podstawie tego opisu dało się wygenerować podobny obraz. Uwzględnij tę zmianę względem oryginału: "${
                instruction?.trim() || "brak — zrób wariant tego samego obrazu"
              }". Zwróć WYŁĄCZNIE gotowy opis do generatora obrazów — bez wstępu, bez cudzysłowów, bez dodatkowych komentarzy.`,
            },
          ],
        },
      ],
    });

    return Response.json({ prompt: text });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: `Nie udało się opisać obrazu: ${message}` },
      { status: 500 }
    );
  }
}
