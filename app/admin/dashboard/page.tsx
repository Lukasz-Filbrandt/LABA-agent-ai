"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/app/lib/auth-context";

type DailyPoint = { date: string; tokeny: number; rozmowy: number };
type EndpointUsage = { endpoint: string; tokeny: number };
type RecentConversation = {
  id: number;
  email: string;
  title: string;
  createdAt: string;
  messageCount: number;
};

type DashboardData = {
  stats: { users: number; conversations: number; tokensToday: number; costTodayUsd: number };
  daily: DailyPoint[];
  byEndpoint: EndpointUsage[];
  recentConversations: RecentConversation[];
};

const PIE_COLORS = ["#8b5cf6", "#6366f1", "#22d3ee", "#f59e0b", "#fb7185", "#34d399"];

const cardStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  padding: 20,
};

const emptyStyle: React.CSSProperties = {
  ...cardStyle,
  color: "var(--color-text-muted)",
  fontSize: 13,
};

function formatNumber(n: number): string {
  return n.toLocaleString("pl-PL");
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(usd < 0.01 ? 4 : 2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{children}</h2>;
}

const axisTickStyle = { fill: "var(--color-text-muted)", fontSize: 12 };
const tooltipStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--color-text)",
};

export default function UsageDashboardPage() {
  const { getAccessToken } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/dashboard", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.status === 403) {
        setForbidden(true);
        setData(null);
        return;
      }
      if (!res.ok) throw new Error(`Błąd ${res.status}`);
      setForbidden(false);
      setData((await res.json()) as DashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się wczytać danych.");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 16px 64px" }}>
      <header
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>📊 Dashboard</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
            Rozmowy, użytkownicy, tokeny i koszty agenta
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void load()}
          disabled={loading}
          style={{ padding: "8px 16px", borderRadius: 8 }}
        >
          🔄 Odśwież
        </button>
      </header>

      {loading && !data && !forbidden && (
        <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>Wczytuję dane...</p>
      )}

      {forbidden && (
        <div style={{ ...cardStyle, textAlign: "center", color: "var(--color-danger)" }}>
          Brak dostępu — ten panel jest dostępny tylko dla administratorów.
        </div>
      )}

      {error && (
        <div style={{ ...cardStyle, textAlign: "center", color: "var(--color-danger)" }}>⚠️ {error}</div>
      )}

      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <section>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 12,
              }}
            >
              <StatTile label="👥 Użytkownicy" value={formatNumber(data.stats.users)} />
              <StatTile label="💬 Rozmowy" value={formatNumber(data.stats.conversations)} />
              <StatTile label="🔤 Tokeny dziś" value={formatNumber(data.stats.tokensToday)} />
              <StatTile label="💰 Koszt dziś" value={formatCost(data.stats.costTodayUsd)} />
            </div>
          </section>

          <section>
            <SectionTitle>📈 Tokeny per dzień (ostatnie 7 dni)</SectionTitle>
            <div style={{ ...cardStyle, height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.daily} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={axisTickStyle} axisLine={{ stroke: "var(--color-border)" }} />
                  <YAxis tick={axisTickStyle} axisLine={{ stroke: "var(--color-border)" }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--color-text)" }} />
                  <Line
                    type="monotone"
                    dataKey="tokeny"
                    name="Tokeny"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#8b5cf6" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section>
            <SectionTitle>💬 Rozmowy per dzień (ostatnie 7 dni)</SectionTitle>
            <div style={{ ...cardStyle, height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.daily} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={axisTickStyle} axisLine={{ stroke: "var(--color-border)" }} />
                  <YAxis tick={axisTickStyle} axisLine={{ stroke: "var(--color-border)" }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--color-text)" }} />
                  <Bar dataKey="rozmowy" name="Rozmowy" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section>
            <SectionTitle>🥧 Tokeny per endpoint (ostatnie 7 dni)</SectionTitle>
            {data.byEndpoint.length === 0 ? (
              <div style={emptyStyle}>Brak danych o zużyciu w tym okresie.</div>
            ) : (
              <div style={{ ...cardStyle, height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.byEndpoint}
                      dataKey="tokeny"
                      nameKey="endpoint"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={(props: { name?: string; percent?: number }) =>
                        `${props.name} (${Math.round((props.percent ?? 0) * 100)}%)`
                      }
                    >
                      {data.byEndpoint.map((entry, i) => (
                        <Cell key={entry.endpoint} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--color-text)" }} />
                    <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-text-muted)" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section>
            <SectionTitle>🕘 Ostatnie rozmowy</SectionTitle>
            {data.recentConversations.length === 0 ? (
              <div style={emptyStyle}>Brak rozmów.</div>
            ) : (
              <div style={{ ...cardStyle, padding: 0, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr
                      style={{
                        textAlign: "left",
                        color: "var(--color-text-muted)",
                        fontSize: 11,
                        textTransform: "uppercase",
                      }}
                    >
                      <th style={{ padding: "12px 16px" }}>Email</th>
                      <th style={{ padding: "12px 16px" }}>Tytuł</th>
                      <th style={{ padding: "12px 16px" }}>Data</th>
                      <th style={{ padding: "12px 16px" }}>Wiadomości</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentConversations.map((c) => (
                      <tr key={c.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                        <td style={{ padding: "10px 16px" }}>{c.email}</td>
                        <td style={{ padding: "10px 16px" }}>{c.title}</td>
                        <td style={{ padding: "10px 16px", color: "var(--color-text-muted)" }}>
                          {formatDate(c.createdAt)}
                        </td>
                        <td style={{ padding: "10px 16px" }}>{c.messageCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
