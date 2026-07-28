import { generateAndSaveBriefing } from "@/app/lib/briefing";
import { supabaseForRequest } from "@/app/lib/supabase-server";

export const maxDuration = 60;

/**
 * Ręczne wygenerowanie briefingu z przycisku na /briefings.
 * Autoryzacja sesją zalogowanego usera — inaczej niż /api/cron/morning, który
 * chroni się sekretem. Dzięki temu CRON_SECRET nie musi trafić do przeglądarki.
 */
export async function POST(request: Request) {
  const { user } = await supabaseForRequest(request);
  if (!user) {
    return Response.json(
      { success: false, error: "Musisz być zalogowany, żeby wygenerować briefing." },
      { status: 401 }
    );
  }

  const result = await generateAndSaveBriefing(user.id);

  if (!result.ok) {
    return Response.json({ success: false, error: result.error }, { status: 500 });
  }

  return Response.json({ success: true, id: result.id, date: result.date });
}
