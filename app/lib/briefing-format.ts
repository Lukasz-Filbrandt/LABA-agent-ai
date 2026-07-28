/** "2026-07-13" → "13 lipca 2026, poniedziałek" */
export function formatBriefingDate(isoDate: string) {
  // Południe zamiast północy — chroni przed przesunięciem daty o dzień w strefach za UTC
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;

  const day = new Intl.DateTimeFormat("pl-PL", { dateStyle: "long" }).format(date);
  const weekday = new Intl.DateTimeFormat("pl-PL", { weekday: "long" }).format(date);
  return `${day}, ${weekday}`;
}

/** Zdejmuje znaczniki markdown, żeby podgląd na karcie czytał się jak zwykły tekst */
export function toPlainPreview(markdown: string, max = 150) {
  const plain = markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  return plain.length > max ? `${plain.slice(0, max)}...` : plain;
}
