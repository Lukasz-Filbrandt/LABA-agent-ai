function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Formatuje datę po polsku: "przed chwilą", "23 min temu", "wczoraj", "3 dni temu" albo pełną datę (patrz W4_LISTA_ROZMOW.md) */
export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (diffMin < 1) return "przed chwilą";
  if (diffMin < 60) return `${diffMin} min temu`;

  const dayDiff = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / 86400000
  );

  if (dayDiff === 0) return `${Math.floor(diffMin / 60)} godz. temu`;
  if (dayDiff === 1) return "wczoraj";
  if (dayDiff < 7) return `${dayDiff} dni temu`;

  return date.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Formatuje godzinę wiadomości, np. "14:32" */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
