const MAX_LENGTH = 2000;

// Próby złamania instrukcji / wyciągnięcia system promptu — patrz lekcja_10/W1_RED_TEAMING.md
const BLOCKED_PATTERNS: RegExp[] = [
  /ignore previous/i,
  /ignore (all )?instructions/i,
  /system prompt/i,
  /reveal/i,
  /show me your/i,
  /translate your prompt/i,
  /zignoruj (poprzednie|wszystkie) instrukcj/i,
  /poka.{1,2} (mi )?(swoje |sw[oó]j )?(instrukcj|prompt)/i,
  /wypisz (sw[oó]j |ca[łl]y )?(system )?prompt/i,
  /jaki jest (pe[łl]ny |ca[łl]y )?prompt/i,
  /udawaj[, ]+.e jeste.{1,2}/i,
];

// Znaki kontrolne (poza \n, \t) i niewidoczne spacje zero-width, którymi można maskować ataki
const CONTROL_AND_ZERO_WIDTH =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\uFEFF]/g;

export const BLOCKED_MESSAGE = "Ta wiadomość została zablokowana z powodów bezpieczeństwa.";

/** Usuwa znaki kontrolne i zero-width spaces, którymi można ukryć wzorce ataku przed blacklistą */
export function sanitizeText(text: string): string {
  return text.replace(CONTROL_AND_ZERO_WIDTH, "");
}

export type InputValidation = { ok: true } | { ok: false; reason: string };

/** Waliduje wiadomość usera PRZED wysłaniem do LLM: długość + blacklista prób prompt injection */
export function validateInput(text: string): InputValidation {
  const sanitized = sanitizeText(text);

  if (sanitized.length > MAX_LENGTH) {
    return {
      ok: false,
      reason: `Wiadomość jest za długa (max ${MAX_LENGTH} znaków, otrzymano ${sanitized.length}).`,
    };
  }

  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(sanitized))) {
    return { ok: false, reason: BLOCKED_MESSAGE };
  }

  return { ok: true };
}
