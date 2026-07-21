import { google } from "@ai-sdk/google";
import { embed } from "ai";
import { supabase } from "@/app/lib/supabase";
import { splitIntoChunks } from "@/app/lib/chunking";

function line(data: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(data)}\n`);
}

export async function POST(req: Request) {
  const { title, content }: { title?: string; content?: string } = await req.json();

  if (!title?.trim() || !content?.trim()) {
    return Response.json({ error: "Podaj tytuł i treść dokumentu." }, { status: 400 });
  }

  const chunks = splitIntoChunks(content);
  if (chunks.length === 0) {
    return Response.json({ error: "Nie udało się podzielić treści na fragmenty." }, { status: 400 });
  }

  const trimmedTitle = title.trim();

  const stream = new ReadableStream({
    async start(controller) {
      let saved = 0;
      try {
        // Sekwencyjnie, nie równolegle — żeby nie przekroczyć rate limit API embeddingów
        for (let i = 0; i < chunks.length; i++) {
          controller.enqueue(line({ type: "progress", current: i + 1, total: chunks.length }));

          const { embedding } = await embed({
            model: google.textEmbeddingModel("gemini-embedding-001"),
            value: chunks[i],
            // vector(768) w Supabase — model domyślnie zwraca 3072 wymiary, trzeba je przyciąć
            providerOptions: { google: { outputDimensionality: 768 } },
          });

          const { error } = await supabase.from("documents").insert({
            title: trimmedTitle,
            content: chunks[i],
            embedding,
            metadata: { source: trimmedTitle, chunk_index: i, total_chunks: chunks.length },
          });
          if (error) throw new Error(error.message);

          saved++;
        }

        controller.enqueue(line({ type: "done", chunks_saved: saved }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        controller.enqueue(line({ type: "error", message, chunks_saved: saved }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
