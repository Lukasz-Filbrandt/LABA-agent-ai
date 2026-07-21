/** Zamienia techniczny błąd (w tym surowe komunikaty API Google) na czytelną podpowiedź po polsku */
export function errorHint(error: Error | string): string {
  const msg = (typeof error === "string" ? error : error.message || "").toLowerCase();
  if (/quota|rate|429|resource_exhausted/.test(msg)) {
    return "Przekroczony limit darmowego planu Google AI — odczekaj chwilę (limit odnawia się co minutę / dobę) i spróbuj ponownie.";
  }
  if (/api[_ ]?key|permission|401|403/.test(msg)) {
    return "Problem z kluczem API — sprawdź GOOGLE_GENERATIVE_AI_API_KEY w pliku .env.local.";
  }
  return "Sprawdź połączenie z internetem i spróbuj ponownie.";
}

/** true, jeśli komunikat błędu wskazuje na wyczerpany limit darmowego planu Google AI */
export function isQuotaError(error: Error | string): boolean {
  const msg = (typeof error === "string" ? error : error.message || "").toLowerCase();
  return /quota|rate|429|resource_exhausted/.test(msg);
}
