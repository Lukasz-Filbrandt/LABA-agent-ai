import { GoogleGenAI, Modality } from "@google/genai";

const MODEL = "gemini-3.1-flash-lite-image";
const DEFAULT_TIMEOUT_MS = 30000;

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export type GeneratedImage = { image: string; text?: string };

export async function generateImageFromPrompt(
  prompt: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<GeneratedImage> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
      httpOptions: { timeout: timeoutMs },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];

  let image: string | undefined;
  let text: string | undefined;

  for (const part of parts) {
    if (part.inlineData?.data) {
      const mimeType = part.inlineData.mimeType ?? "image/png";
      image = `data:${mimeType};base64,${part.inlineData.data}`;
    } else if (part.text) {
      text = part.text;
    }
  }

  if (!image) {
    throw new Error("Model nie zwrócił obrazu. Spróbuj zmienić opis.");
  }

  return { image, text };
}
