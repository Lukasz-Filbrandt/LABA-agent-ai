import { useCallback, useRef, useState } from "react";

/** Mierzy czas trwania odpowiedzi agenta per wiadomość — zasila panel Diagnostyka ("Czas: 3.2s") */
export function useMessageTimer() {
  const startRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState<Record<string, number>>({});

  const start = useCallback(() => {
    startRef.current = performance.now();
  }, []);

  const finish = useCallback((messageId: string) => {
    if (startRef.current == null) return;
    const seconds = (performance.now() - startRef.current) / 1000;
    setElapsed((prev) => ({ ...prev, [messageId]: seconds }));
  }, []);

  const liveSeconds = useCallback(() => {
    return startRef.current == null ? 0 : (performance.now() - startRef.current) / 1000;
  }, []);

  const reset = useCallback(() => {
    startRef.current = null;
    setElapsed({});
  }, []);

  return { start, finish, elapsed, liveSeconds, reset };
}
