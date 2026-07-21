import { tool } from "ai";
import { z } from "zod";

/** Bezpieczny parser wyrażeń arytmetycznych (+ - * / % nawiasy) — bez eval/Function */
function evaluateExpression(input: string): number {
  const src = input.replace(/,/g, ".");
  let i = 0;

  const skipSpace = () => {
    while (src[i] === " " || src[i] === "\t") i++;
  };

  const parseNumber = (): number => {
    skipSpace();
    const start = i;
    while (i < src.length && /[0-9.]/.test(src[i])) i++;
    if (start === i) {
      throw new Error(`Oczekiwano liczby na pozycji ${i}`);
    }
    const value = Number(src.slice(start, i));
    if (Number.isNaN(value)) {
      throw new Error(`Nieprawidłowa liczba: "${src.slice(start, i)}"`);
    }
    return value;
  };

  const parsePrimary = (): number => {
    skipSpace();
    if (src[i] === "(") {
      i++;
      const value = parseExpr();
      skipSpace();
      if (src[i] !== ")") throw new Error("Brak zamykającego nawiasu");
      i++;
      return value;
    }
    if (src[i] === "-" || src[i] === "+") {
      const sign = src[i];
      i++;
      const value = parsePrimary();
      return sign === "-" ? -value : value;
    }
    return parseNumber();
  };

  const parseTerm = (): number => {
    let value = parsePrimary();
    skipSpace();
    while (src[i] === "*" || src[i] === "/" || src[i] === "%") {
      const op = src[i];
      i++;
      const rhs = parsePrimary();
      if (op === "*") value *= rhs;
      else if (op === "/") {
        if (rhs === 0) throw new Error("Dzielenie przez zero");
        value /= rhs;
      } else {
        value %= rhs;
      }
      skipSpace();
    }
    return value;
  };

  const parseExpr = (): number => {
    let value = parseTerm();
    skipSpace();
    while (src[i] === "+" || src[i] === "-") {
      const op = src[i];
      i++;
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
      skipSpace();
    }
    return value;
  };

  const result = parseExpr();
  skipSpace();
  if (i !== src.length) {
    throw new Error(`Nieoczekiwany znak w wyrażeniu na pozycji ${i}: "${src[i]}"`);
  }
  return result;
}

/** Blokuje próby wstrzyknięcia kodu — parser i tak nie używa eval/Function, ale komunikat ma być jasny */
const BANNED_PATTERN = /\b(import|require|eval|process)\b/i;

export const calculator = tool({
  description:
    "Oblicza wynik wyrażenia matematycznego (dodawanie, odejmowanie, mnożenie, " +
    "dzielenie, modulo, nawiasy). Używaj do dokładnych obliczeń zamiast liczyć w pamięci.",
  inputSchema: z.object({
    expression: z
      .string()
      .describe('Wyrażenie matematyczne, np. "8500 * 0.23" albo "(120 + 30) / 2"'),
  }),
  execute: async ({ expression }) => {
    if (BANNED_PATTERN.test(expression)) {
      return { error: "Wyrażenie zawiera niedozwolone znaki" };
    }
    try {
      return { result: evaluateExpression(expression) };
    } catch {
      return { error: `Nie mogę obliczyć: ${expression}` };
    }
  },
});
