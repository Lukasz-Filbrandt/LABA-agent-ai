import { tool } from "ai";
import { z } from "zod";
import { google } from "@ai-sdk/google";
import { embed } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

const MATCH_THRESHOLD = 0.5;
const MATCH_COUNT = 5;

type MatchRow = {
  id: string;
  title: string;
  content: string;
  similarity: number;
  metadata: { source?: string; chunk_index?: number; total_chunks?: number } | null;
};

/** Wyszukiwanie w bazie wiedzy firmy (RAG) — patrz W3_SEARCH.md/W4_CYTOWANIE.md. Ten sam model i wymiar
 * wektora co /api/upload-knowledge (W2_UPLOAD.md), inaczej porównanie z embeddingami w tabeli documents
 * nie ma sensu. Dokłada added_at i source_documents, żeby agent miał czym cytować źródło odpowiedzi.
 * `supabase` musi być klientem autoryzowanym tokenem usera (patrz app/lib/supabase-server.ts) — RLS na
 * documents ogranicza wyniki match_documents do dokumentów właściciela (W3_LOGIN_PRYWATNOSC.md). */
export function createKnowledgeTools(supabase: SupabaseClient) {
  const searchKnowledge = tool({
  description:
    "Wyszukuje informacje w bazie wiedzy firmy (cenniki, FAQ, regulaminy, oferty). " +
    "Używaj ZAWSZE gdy użytkownik pyta o: ceny, pakiety, koszty; procedury, regulaminy, warunki; " +
    "FAQ, pytania o firmę/usługi; cokolwiek co może być w dokumentach firmowych.",
  inputSchema: z.object({
    query: z.string().describe("Pytanie użytkownika, np. 'ile kosztuje pakiet premium'"),
  }),
  execute: async ({ query }) => {
    try {
      const { embedding } = await embed({
        model: google.textEmbeddingModel("gemini-embedding-001"),
        value: query,
        providerOptions: { google: { outputDimensionality: 768 } },
      });

      const { data, error } = await supabase.rpc("match_documents", {
        query_embedding: embedding,
        match_threshold: MATCH_THRESHOLD,
        match_count: MATCH_COUNT,
      });

      if (error) {
        return { results: [], total_found: 0, message: `Błąd wyszukiwania: ${error.message}`, source_documents: [] };
      }

      const matches = (data as MatchRow[] | null) ?? [];
      if (matches.length === 0) {
        return {
          results: [],
          total_found: 0,
          message: "Nie znaleziono informacji w bazie wiedzy.",
          source_documents: [],
        };
      }

      // match_documents nie zwraca created_at — dociągamy je osobno po id, żeby nie modyfikować
      // funkcji SQL (wymagałoby ręcznej migracji w Supabase, tak jak przy tabeli documents)
      const { data: dated } = await supabase
        .from("documents")
        .select("id, created_at")
        .in("id", matches.map((m) => m.id));
      const addedAtById = new Map((dated ?? []).map((d) => [d.id, d.created_at as string]));

      const results = matches.map((r) => ({
        title: r.title,
        content: r.content,
        similarity: r.similarity,
        metadata: r.metadata ?? {},
        added_at: addedAtById.get(r.id) ?? null,
      }));

      const source_documents = [...new Set(results.map((r) => r.title))];

      return { results, total_found: results.length, source_documents };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { results: [], total_found: 0, message: `Błąd wyszukiwania: ${message}`, source_documents: [] };
    }
  },
  });

  return { searchKnowledge };
}
