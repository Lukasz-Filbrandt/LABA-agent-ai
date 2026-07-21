export type ToolPart = {
  type: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

export function isToolPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

export function toolPartName(part: ToolPart): string {
  return part.toolName ?? part.type.replace(/^tool-/, "");
}

/**
 * Wykrywa błąd wywołania narzędzia z dwóch niezależnych źródeł:
 * 1. state:"output-error" — awaria na poziomie SDK (np. AI_NoSuchToolError, timeout streamu)
 * 2. output.error — narzędzie wykonało się poprawnie, ale samo zwróciło { error: "..." }
 */
function errorMessage(part: ToolPart): string | null {
  if (part.state === "output-error" && part.errorText) {
    return part.errorText;
  }
  const output = part.output;
  if (typeof output === "object" && output !== null && "error" in output) {
    const value = (output as Record<string, unknown>).error;
    return value ? String(value) : null;
  }
  return null;
}

export type DiagnosticsStatus = "loading" | "limit" | "done";

export type Diagnostics = {
  steps: number;
  maxSteps: number;
  toolCounts: { name: string; count: number }[];
  errorCount: number;
  errors: { name: string; input: unknown; message: string }[];
  status: DiagnosticsStatus;
  barColor: string;
};

/** Zlicza kroki, narzędzia i błędy z toolInvocations wiadomości — zasila panel Diagnostyka */
export function computeDiagnostics(
  toolParts: ToolPart[],
  maxSteps: number,
  isLoading: boolean
): Diagnostics {
  const steps = toolParts.length;
  const counts = new Map<string, number>();
  const errors: { name: string; input: unknown; message: string }[] = [];

  for (const part of toolParts) {
    const name = toolPartName(part);
    counts.set(name, (counts.get(name) ?? 0) + 1);
    const message = errorMessage(part);
    if (message) errors.push({ name, input: part.input, message });
  }

  const status: DiagnosticsStatus = isLoading ? "loading" : steps >= maxSteps ? "limit" : "done";
  const barColor =
    steps >= maxSteps
      ? "var(--color-danger)"
      : steps === maxSteps - 1
        ? "#d97706"
        : "var(--color-primary)";

  return {
    steps,
    maxSteps,
    toolCounts: Array.from(counts.entries()).map(([name, count]) => ({ name, count })),
    errorCount: errors.length,
    errors,
    status,
    barColor,
  };
}
