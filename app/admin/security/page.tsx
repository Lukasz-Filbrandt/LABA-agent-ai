"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/app/lib/auth-context";

type BlockedMessage = {
  id: string;
  userId: string;
  email: string;
  preview: string;
  reason: string;
  createdAt: string;
};

type TopUser = {
  userId: string;
  email: string;
  tokensToday: number;
  tokensWeek: number;
  percentOfLimit: number;
};

type SecurityAlert = {
  type: "blocked" | "limit" | "spam";
  userId: string;
  email: string;
  message: string;
  createdAt?: string;
};

type SecurityData = {
  blocked: BlockedMessage[];
  top5: TopUser[];
  alerts: SecurityAlert[];
  stats: {
    totalTokensToday: number;
    totalTokensWeek: number;
    blockedCount: number;
    avgPerUser: number;
    activeUsersWeek: number;
  };
};

const ALERT_ICON: Record<SecurityAlert["type"], string> = {
  blocked: "🚫",
  limit: "⚠️",
  spam: "📨",
};

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNumber(n: number): string {
  return n.toLocaleString("pl-PL");
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

export default function SecurityPanelPage() {
  const { getAccessToken } = useAuth();
  const [data, setData] = useState<SecurityData | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/security", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.status === 403) {
        setForbidden(true);
        setData(null);
        return;
      }
      if (!res.ok) throw new Error(`Błąd ${res.status}`);
      setForbidden(false);
      setData((await res.json()) as SecurityData);
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
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 16px 64px" }}>
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
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>🛡️ Panel bezpieczeństwa</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
            Zablokowane wiadomości, zużycie tokenów i alerty
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
            <SectionTitle>📈 Statystyki</SectionTitle>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 12,
              }}
            >
              <StatTile label="Tokeny dziś (wszyscy)" value={formatNumber(data.stats.totalTokensToday)} />
              <StatTile label="Tokeny w tygodniu" value={formatNumber(data.stats.totalTokensWeek)} />
              <StatTile label="Zablokowane wiadomości" value={data.stats.blockedCount} />
              <StatTile
                label="Śr. zużycie / user (tydzień)"
                value={formatNumber(data.stats.avgPerUser)}
              />
            </div>
          </section>

          <section>
            <SectionTitle>🔴 Alerty</SectionTitle>
            {data.alerts.length === 0 ? (
              <div style={emptyStyle}>Brak alertów. Wszystko wygląda spokojnie.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.alerts.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      ...cardStyle,
                      padding: "12px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                      borderColor: "var(--color-danger-border)",
                      background: "var(--color-danger-bg)",
                    }}
                  >
                    <span style={{ fontSize: 13 }}>
                      {ALERT_ICON[a.type]} <strong>{a.email}</strong> — {a.message}
                    </span>
                    {a.createdAt && (
                      <span style={{ fontSize: 11, color: "var(--color-text-muted)", flexShrink: 0 }}>
                        {formatDate(a.createdAt)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionTitle>📊 Top 5 użytkowników po zużyciu</SectionTitle>
            {data.top5.length === 0 ? (
              <div style={emptyStyle}>Brak danych o zużyciu w tym tygodniu.</div>
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
                      <th style={{ padding: "12px 16px" }}>Tokeny dziś</th>
                      <th style={{ padding: "12px 16px" }}>Tokeny w tygodniu</th>
                      <th style={{ padding: "12px 16px" }}>% limitu dziennego</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top5.map((u) => (
                      <tr key={u.userId} style={{ borderTop: "1px solid var(--color-border)" }}>
                        <td style={{ padding: "10px 16px" }}>{u.email}</td>
                        <td style={{ padding: "10px 16px" }}>{formatNumber(u.tokensToday)}</td>
                        <td style={{ padding: "10px 16px" }}>{formatNumber(u.tokensWeek)}</td>
                        <td
                          style={{
                            padding: "10px 16px",
                            color: u.percentOfLimit >= 80 ? "var(--color-danger)" : "inherit",
                            fontWeight: u.percentOfLimit >= 80 ? 700 : 400,
                          }}
                        >
                          {u.percentOfLimit}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <SectionTitle>⚠️ Zablokowane wiadomości</SectionTitle>
            {data.blocked.length === 0 ? (
              <div style={emptyStyle}>Brak zablokowanych wiadomości.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.blocked.map((b) => (
                  <div key={b.id} style={{ ...cardStyle, padding: "12px 16px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <strong style={{ fontSize: 13 }}>{b.email}</strong>
                      <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                        {formatDate(b.createdAt)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontStyle: "italic",
                        color: "var(--color-text-muted)",
                        marginTop: 6,
                      }}
                    >
                      „{b.preview}”
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-danger)", marginTop: 6 }}>
                      Powód: {b.reason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
