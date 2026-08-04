import Link from "next/link";

const FEATURES = [
  {
    icon: "🧠",
    title: "Pamięta Twoje rozmowy",
    desc: "Kontynuuje wątek tam, gdzie skończyliście — bez powtarzania kontekstu za każdym razem.",
  },
  {
    icon: "📚",
    title: "Zna dokumenty Twojej firmy",
    desc: "Odpowiada na bazie wgranych plików i wiedzy, którą mu przekażesz — nie zgaduje.",
  },
  {
    icon: "🔐",
    title: "Prywatne dane per user",
    desc: "Twoje rozmowy i dokumenty widzisz tylko Ty. Zero mieszania danych między kontami.",
  },
  {
    icon: "⚡",
    title: "Pracuje 24/7 (cron jobs)",
    desc: "Briefingi, raporty i zadania w tle — agent działa, nawet gdy nie masz otwartej karty.",
  },
];

export default function LandingPage() {
  return (
    <div className="landing-shell">
      <div className="landing-glow landing-glow-a" aria-hidden="true" />
      <div className="landing-glow landing-glow-b" aria-hidden="true" />

      <nav className="landing-nav">
        <span className="landing-brand">
          <span className="icon-badge">⚡</span>
          <span className="landing-brand-name">Nexus AI</span>
        </span>
        <Link href="/login" className="btn btn-ghost landing-nav-cta">
          Zaloguj się
        </Link>
      </nav>

      <header className="landing-hero">
        <span className="landing-badge">Prywatny Agent AI</span>
        <h1 className="landing-title">Nexus AI</h1>
        <p className="landing-tagline">
          Twój osobisty asystent AI z pamięcią i bazą wiedzy firmy — zawsze pod ręką, zawsze na bieżąco.
        </p>
        <div className="landing-cta-row">
          <Link href="/login" className="btn btn-primary landing-cta-primary">
            🚀 Zacznij za darmo
          </Link>
          <a href="#demo" className="btn btn-ghost landing-cta-secondary">
            Zobacz jak to działa
          </a>
        </div>
      </header>

      <section className="landing-features" aria-label="Funkcje">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className="landing-feature-card"
            style={{ animationDelay: `${0.08 * i}s` }}
          >
            <span className="landing-feature-icon">{f.icon}</span>
            <h3 className="landing-feature-title">{f.title}</h3>
            <p className="landing-feature-desc">{f.desc}</p>
          </div>
        ))}
      </section>

      <section id="demo" className="landing-demo" aria-label="Demo">
        <div className="landing-demo-copy">
          <span className="landing-badge">Zobacz w akcji</span>
          <h2 className="landing-demo-title">Zapytaj o cennik → agent odpowiada z Twoich dokumentów</h2>
          <p className="landing-demo-desc">
            Bez przekopywania folderów i maili. Wgraj dokumenty raz, a Nexus AI znajdzie odpowiedź za Ciebie —
            z odwołaniem do źródła.
          </p>
        </div>

        <div className="landing-demo-window">
          <div className="landing-demo-titlebar">
            <span className="landing-demo-dots">
              <i /> <i /> <i />
            </span>
            <span className="landing-demo-titlebar-label">💬 Chat — Nexus AI</span>
          </div>
          <div className="landing-demo-body">
            <div className="landing-chat-bubble landing-chat-bubble--user">
              Jaki mamy cennik dla planu Pro?
            </div>
            <div className="landing-chat-bubble landing-chat-bubble--bot">
              Zgodnie z <strong>cennik_2026.pdf</strong>: plan Pro kosztuje 149 zł/mies. i obejmuje nielimitowane
              zapytania oraz priorytetowe wsparcie. 📄
            </div>
            <div className="landing-chat-bubble landing-chat-bubble--user">
              A czy jest zniżka roczna?
            </div>
            <div className="landing-chat-bubble landing-chat-bubble--bot landing-chat-bubble--typing">
              <span /> <span /> <span />
            </div>
          </div>
        </div>
      </section>

      <section className="landing-cta-footer">
        <h2 className="landing-cta-footer-title">Gotowy? Zacznij w 30 sekund.</h2>
        <Link href="/login" className="btn btn-primary landing-cta-primary">
          Stwórz konto
        </Link>
        <p className="landing-footer-note">Bez karty kredytowej. Anuluj w każdej chwili.</p>
      </section>
    </div>
  );
}
