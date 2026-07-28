import { generateAndSaveBriefing } from "@/app/lib/briefing";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { success: false, error: "CRON_SECRET nie jest skonfigurowany." },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await generateAndSaveBriefing();

  if (!result.ok) {
    return Response.json({ success: false, error: result.error }, { status: 500 });
  }

  return Response.json({
    success: true,
    date: result.date,
    preview: result.content.slice(0, 200),
  });
}
