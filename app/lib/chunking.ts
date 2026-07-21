const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_OVERLAP = 50;

/**
 * Dzieli tekst na fragmenty (chunki) gotowe do zaembedowania — patrz W2_UPLOAD.md.
 * Tnie po granicach zdań/linii (nigdy w środku zdania), łączy je w fragmenty ~chunkSize znaków,
 * a każdy kolejny fragment zaczyna się od ogona (overlap) poprzedniego, żeby nie tracić kontekstu
 * na granicy cięcia (np. zdanie tłumaczące cenę zostaje widoczne w obu sąsiadujących fragmentach).
 */
export function splitIntoChunks(
  text: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_OVERLAP
): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) return [];

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;

    if (candidate.length > chunkSize && current) {
      chunks.push(current);
      const tail = current.slice(-overlap).trim();
      current = tail ? `${tail} ${sentence}` : sentence;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);

  return chunks;
}
