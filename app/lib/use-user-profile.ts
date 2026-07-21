"use client";

import { useCallback, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";

const STORAGE_KEY = "user_id";

/**
 * Identyfikuje użytkownika przez id zapisane w localStorage (patrz W3_IMIE.md).
 * user_profiles.id w tym projekcie jest typu bigint (nadawane przez bazę), więc — zamiast
 * generować uuid po stronie przeglądarki — pierwsza wizyta tworzy rekord i zapamiętuje
 * zwrócone z Supabase id; kolejne wizyty odczytują profil po tym id.
 */
export function useUserProfile(enabled: boolean) {
  const userIdRef = useRef<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(enabled);

  const loadProfile = useCallback(async (): Promise<string | null> => {
    if (!enabled) return null;
    try {
      const storedId = localStorage.getItem(STORAGE_KEY);

      if (storedId) {
        const { data } = await supabase
          .from("user_profiles")
          .select("id, name")
          .eq("id", storedId)
          .maybeSingle();

        if (data) {
          userIdRef.current = String(data.id);
          return data.name ?? null;
        }
        // Id jest w localStorage, ale rekordu nie ma w bazie (np. wyczyszczona baza) — utwórz nowy poniżej.
      }

      const { data, error } = await supabase
        .from("user_profiles")
        .insert({ name: null, preferences: {} })
        .select("id")
        .single();
      if (error || !data) throw error;

      userIdRef.current = String(data.id);
      localStorage.setItem(STORAGE_KEY, String(data.id));
      return null;
    } catch (err) {
      console.error("Nie udało się wczytać profilu użytkownika:", err);
      return null;
    } finally {
      setIsLoadingProfile(false);
    }
  }, [enabled]);

  const getUserId = useCallback(() => userIdRef.current, []);

  return { isLoadingProfile, loadProfile, getUserId };
}
