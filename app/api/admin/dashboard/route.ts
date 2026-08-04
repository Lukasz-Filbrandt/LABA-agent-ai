import { supabaseForRequest, supabaseServiceRole } from "@/app/lib/supabase-server";
import { isAdminEmail } from "@/app/lib/admin-auth";

const DAYS_BACK = 7;
// Orientacyjny cennik (Gemini Flash-Lite, $/1M tokenów) — patrz W2_DASHBOARD_UZYCIA.md, sekcja "Koszt dziś"
const PRICE_PER_1M_INPUT_USD = 0.15;
const PRICE_PER_1M_OUTPUT_USD = 0.6;
const RECENT_CONVERSATIONS_LIMIT = 10;

type ConversationRow = { id: number; user_id: string; title: string | null; created_at: string };
type UsageRow = {
  created_at: string;
  tokens_input: number | null;
  tokens_output: number | null;
  endpoint: string;
};

function startOfTodayISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/** Dzień (UTC, YYYY-MM-DD) sprzed `daysAgo` dni — używane do budowania osi X wykresów */
function dayKeyAgo(daysAgo: number): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo));
  return d.toISOString().slice(0, 10);
}

function dayLabel(dayKey: string): string {
  const [, month, day] = dayKey.split("-");
  return `${day}.${month}`;
}

export async function GET(req: Request) {
  const { user } = await supabaseForRequest(req);
  if (!isAdminEmail(user?.email)) {
    return Response.json({ error: "Brak dostępu." }, { status: 403 });
  }

  const admin = supabaseServiceRole();
  const todaySince = startOfTodayISO();
  const weekSince = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000).toISOString();

  const [conversationsRes, usageWeekRes, usersRes] = await Promise.all([
    admin
      .from("conversations")
      .select("id, user_id, title, created_at")
      .order("created_at", { ascending: false }),
    admin
      .from("api_usage")
      .select("created_at, tokens_input, tokens_output, endpoint")
      .gte("created_at", weekSince),
    // Uwaga: listUsers domyślnie zwraca 50 userów/stronę — perPage:1000 pokrywa cały (mały) kurs.
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const emailById = new Map<string, string>();
  for (const u of usersRes.data?.users ?? []) {
    if (u.email) emailById.set(u.id, u.email);
  }
  const emailFor = (id: string) => emailById.get(id) ?? id;

  const conversations = (conversationsRes.data ?? []) as ConversationRow[];
  const usageWeek = (usageWeekRes.data ?? []) as UsageRow[];

  // --- Karty z liczbami ---
  const distinctUsers = new Set(conversations.map((c) => c.user_id)).size;
  const totalConversations = conversations.length;

  const usageToday = usageWeek.filter((row) => row.created_at >= todaySince);
  const tokensInputToday = usageToday.reduce((sum, r) => sum + (r.tokens_input ?? 0), 0);
  const tokensOutputToday = usageToday.reduce((sum, r) => sum + (r.tokens_output ?? 0), 0);
  const tokensToday = tokensInputToday + tokensOutputToday;
  const costTodayUsd =
    (tokensInputToday / 1_000_000) * PRICE_PER_1M_INPUT_USD +
    (tokensOutputToday / 1_000_000) * PRICE_PER_1M_OUTPUT_USD;

  // --- Wykresy: ostatnie 7 dni ---
  const dayKeys = Array.from({ length: DAYS_BACK }, (_, i) => dayKeyAgo(DAYS_BACK - 1 - i));
  const tokensByDay = new Map<string, number>(dayKeys.map((d) => [d, 0]));
  for (const row of usageWeek) {
    const key = row.created_at.slice(0, 10);
    if (tokensByDay.has(key)) {
      tokensByDay.set(key, (tokensByDay.get(key) ?? 0) + (row.tokens_input ?? 0) + (row.tokens_output ?? 0));
    }
  }

  const conversationsByDay = new Map<string, number>(dayKeys.map((d) => [d, 0]));
  for (const conv of conversations) {
    const key = conv.created_at.slice(0, 10);
    if (conversationsByDay.has(key)) {
      conversationsByDay.set(key, (conversationsByDay.get(key) ?? 0) + 1);
    }
  }

  const daily = dayKeys.map((key) => ({
    date: dayLabel(key),
    tokeny: tokensByDay.get(key) ?? 0,
    rozmowy: conversationsByDay.get(key) ?? 0,
  }));

  // --- Wykres kołowy: tokeny per endpoint (ostatnie 7 dni) ---
  const tokensByEndpoint = new Map<string, number>();
  for (const row of usageWeek) {
    const tokens = (row.tokens_input ?? 0) + (row.tokens_output ?? 0);
    tokensByEndpoint.set(row.endpoint, (tokensByEndpoint.get(row.endpoint) ?? 0) + tokens);
  }
  const byEndpoint = [...tokensByEndpoint.entries()]
    .map(([endpoint, tokens]) => ({ endpoint, tokeny: tokens }))
    .sort((a, b) => b.tokeny - a.tokeny);

  // --- Tabela: ostatnie 10 rozmów (+ liczba wiadomości per rozmowa) ---
  const recent = conversations.slice(0, RECENT_CONVERSATIONS_LIMIT);
  const recentIds = recent.map((c) => c.id);
  const messageCountByConversation = new Map<number, number>();
  if (recentIds.length > 0) {
    const { data: recentMessages } = await admin
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", recentIds);
    for (const row of (recentMessages ?? []) as { conversation_id: number }[]) {
      messageCountByConversation.set(
        row.conversation_id,
        (messageCountByConversation.get(row.conversation_id) ?? 0) + 1
      );
    }
  }

  const recentConversations = recent.map((c) => ({
    id: c.id,
    email: emailFor(c.user_id),
    title: c.title ?? "(bez tytułu)",
    createdAt: c.created_at,
    messageCount: messageCountByConversation.get(c.id) ?? 0,
  }));

  return Response.json({
    stats: { users: distinctUsers, conversations: totalConversations, tokensToday, costTodayUsd },
    daily,
    byEndpoint,
    recentConversations,
  });
}
