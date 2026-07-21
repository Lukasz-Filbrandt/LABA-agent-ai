"use client";

import { useCallback, useState } from "react";
import { supabase } from "@/app/lib/supabase";

/**
 * Wczytuje (lub tworzy) profil zalogowanego użytkownika w user_profiles, gdzie
 * id = auth.uid() (patrz W3_LOGIN_PRYWATNOSC.md). Zwraca zapisane imię do powitania.
 */
export function useUserProfile(enabled: boolean) {
  const [isLoadingProfile, setIsLoadingProfile] = useState(enabled);

  const loadProfile = useCallback(
    async (userId: string | null): Promise<string | null> => {
      if (!enabled || !userId) {
        setIsLoadingProfile(false);
        return null;
      }
      try {
        const { data } = await supabase
          .from("user_profiles")
          .select("name")
          .eq("id", userId)
          .maybeSingle();

        if (data) return data.name ?? null;

        // Nie nadpisuje istniejącego rekordu (np. przy podwójnym wywołaniu w dev) — tworzy tylko jeśli brak
        await supabase
          .from("user_profiles")
          .upsert({ id: userId, name: null, preferences: {} }, { onConflict: "id", ignoreDuplicates: true });
        return null;
      } catch (err) {
        console.error("Nie udało się wczytać profilu użytkownika:", err);
        return null;
      } finally {
        setIsLoadingProfile(false);
      }
    },
    [enabled]
  );

  return { isLoadingProfile, loadProfile };
}
