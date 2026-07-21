import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/**
 * Klient Supabase autoryzowany tokenem z nagłówka Authorization requestu — dzięki temu
 * zapytania z API respektują RLS (auth.uid()) tak samo jak zapytania z przeglądarki
 * (patrz W3_LOGIN_PRYWATNOSC.md). Bez tego serwerowy klient anon nie ma sesji użytkownika.
 */
export async function supabaseForRequest(
  req: Request
): Promise<{ supabase: SupabaseClient; user: User | null }> {
  const authHeader = req.headers.get("authorization") ?? undefined;
  const token = authHeader?.replace(/^Bearer\s+/i, "");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    authHeader ? { global: { headers: { Authorization: authHeader } } } : undefined
  );

  if (!token) return { supabase, user: null };

  const { data } = await supabase.auth.getUser(token);
  return { supabase, user: data.user };
}
