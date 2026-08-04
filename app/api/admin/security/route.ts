import { supabaseForRequest, supabaseServiceRole } from "@/app/lib/supabase-server";
import { isAdminEmail } from "@/app/lib/admin-auth";

const DAILY_TOKEN_LIMIT = 10000;
const LIMIT_ALERT_RATIO = 0.8;
const SPAM_WINDOW_MINUTES = 10;
const SPAM_MESSAGE_THRESHOLD = 20;
const BLOCKED_LIST_LIMIT = 50;
const BLOCKED_ALERT_LIMIT = 10;

type UsageRow = { user_id: string; tokens_input: number | null; tokens_output: number | null };
type BlockedLogRow = {
  id: string;
  user_id: string;
  created_at: string;
  block_reason: string | null;
  message_preview: string | null;
};
type RecentLogRow = { user_id: string; created_at: string };

type Alert = {
  type: "blocked" | "limit" | "spam";
  userId: string;
  email: string;
  message: string;
  createdAt?: string;
};

function startOfTodayISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/** Suma tokenów per user_id z listy wierszy api_usage */
function sumTokensByUser(rows: UsageRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const tokens = (row.tokens_input ?? 0) + (row.tokens_output ?? 0);
    totals.set(row.user_id, (totals.get(row.user_id) ?? 0) + tokens);
  }
  return totals;
}

export async function GET(req: Request) {
  const { user } = await supabaseForRequest(req);
  if (!isAdminEmail(user?.email)) {
    return Response.json({ error: "Brak dostępu." }, { status: 403 });
  }

  const admin = supabaseServiceRole();
  const todaySince = startOfTodayISO();
  const weekSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const spamSince = new Date(Date.now() - SPAM_WINDOW_MINUTES * 60 * 1000).toISOString();

  const [blockedRes, blockedCountRes, todayUsageRes, weekUsageRes, recentLogsRes, usersRes] =
    await Promise.all([
      admin
        .from("message_logs")
        .select("id, user_id, created_at, block_reason, message_preview")
        .eq("blocked", true)
        .order("created_at", { ascending: false })
        .limit(BLOCKED_LIST_LIMIT),
      admin.from("message_logs").select("id", { count: "exact", head: true }).eq("blocked", true),
      admin.from("api_usage").select("user_id, tokens_input, tokens_output").gte("created_at", todaySince),
      admin.from("api_usage").select("user_id, tokens_input, tokens_output").gte("created_at", weekSince),
      admin.from("message_logs").select("user_id, created_at").gte("created_at", spamSince),
      // Uwaga: listUsers domyślnie zwraca 50 userów/stronę — perPage:1000 pokrywa cały (mały) kurs.
      admin.auth.admin.listUsers({ perPage: 1000 }),
    ]);

  const emailById = new Map<string, string>();
  for (const u of usersRes.data?.users ?? []) {
    if (u.email) emailById.set(u.id, u.email);
  }
  const emailFor = (id: string) => emailById.get(id) ?? id;

  const todayByUser = sumTokensByUser((todayUsageRes.data ?? []) as UsageRow[]);
  const weekByUser = sumTokensByUser((weekUsageRes.data ?? []) as UsageRow[]);

  const top5 = [...weekByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([userId, tokensWeek]) => {
      const tokensToday = todayByUser.get(userId) ?? 0;
      return {
        userId,
        email: emailFor(userId),
        tokensToday,
        tokensWeek,
        percentOfLimit: Math.round((tokensToday / DAILY_TOKEN_LIMIT) * 100),
      };
    });

  const blocked = ((blockedRes.data ?? []) as BlockedLogRow[]).map((row) => ({
    id: row.id,
    userId: row.user_id,
    email: emailFor(row.user_id),
    preview: row.message_preview ?? "",
    reason: row.block_reason ?? "",
    createdAt: row.created_at,
  }));

  const blockedAlerts: Alert[] = blocked.slice(0, BLOCKED_ALERT_LIMIT).map((b) => ({
    type: "blocked",
    userId: b.userId,
    email: b.email,
    message: `Zablokowana wiadomość: ${b.reason}`,
    createdAt: b.createdAt,
  }));

  const limitAlerts: Alert[] = [...todayByUser.entries()]
    .filter(([, tokens]) => tokens >= DAILY_TOKEN_LIMIT * LIMIT_ALERT_RATIO)
    .map(([userId, tokens]) => ({
      type: "limit",
      userId,
      email: emailFor(userId),
      message: `Zużył ${tokens} / ${DAILY_TOKEN_LIMIT} tokenów dziś (${Math.round((tokens / DAILY_TOKEN_LIMIT) * 100)}%)`,
    }));

  const recentCountByUser = new Map<string, number>();
  for (const row of (recentLogsRes.data ?? []) as RecentLogRow[]) {
    recentCountByUser.set(row.user_id, (recentCountByUser.get(row.user_id) ?? 0) + 1);
  }
  const spamAlerts: Alert[] = [...recentCountByUser.entries()]
    .filter(([, count]) => count > SPAM_MESSAGE_THRESHOLD)
    .map(([userId, count]) => ({
      type: "spam",
      userId,
      email: emailFor(userId),
      message: `Wysłał ${count} wiadomości w ciągu ostatnich ${SPAM_WINDOW_MINUTES} minut`,
    }));

  const totalTokensToday = [...todayByUser.values()].reduce((a, b) => a + b, 0);
  const totalTokensWeek = [...weekByUser.values()].reduce((a, b) => a + b, 0);
  const activeUsersWeek = weekByUser.size;
  const avgPerUser = activeUsersWeek > 0 ? Math.round(totalTokensWeek / activeUsersWeek) : 0;

  return Response.json({
    blocked,
    top5,
    alerts: [...blockedAlerts, ...limitAlerts, ...spamAlerts],
    stats: {
      totalTokensToday,
      totalTokensWeek,
      blockedCount: blockedCountRes.count ?? blocked.length,
      avgPerUser,
      activeUsersWeek,
    },
  });
}
