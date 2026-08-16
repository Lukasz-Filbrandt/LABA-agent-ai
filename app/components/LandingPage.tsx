import Link from "next/link";

const FEATURES = [
  {
    icon: "📊",
    title: "PIT, VAT i ryczałt bez stresu",
    desc: "Rozliczenia, terminy zaliczek i wybór formy opodatkowania — konkretna odpowiedź zamiast szukania po forach.",
  },
  {
    icon: "📄",
    title: "Czyta Twoje dokumenty",
    desc: "Wgraj faktury, umowy, PIT-y czy wyciągi — agent przeanalizuje je i odpowie na pytania z odwołaniem do źródła.",
  },
  {
    icon: "✍️",
    title: "Generuje pisma i dokumenty",
    desc: "Czynny żal, wniosek o interpretację, odwołanie od decyzji, pismo do US — gotowy szkic w kilka sekund.",
  },
  {
    icon: "🤝",
    title: "Przygotuje i sprawdzi umowy",
    desc: "Umowa B2B, o dzieło, zlecenie czy najmu — z omówieniem skutków podatkowych każdego zapisu.",
  },
  {
    icon: "📋",
    title: "CV i dokumenty zawodowe",
    desc: "Profesjonalne CV, list motywacyjny i oferta usług — gotowe do pobrania w PDF.",
  },
  {
    icon: "🔐",
    title: "Twoje dane zostają Twoje",
    desc: "Dokumenty i rozmowy widzisz tylko Ty. Zero mieszania danych między kontami.",
  },
];

const TRIAL_POINTS = [
  "Pełny dostęp do wszystkich funkcji przez 7 dni",
  "Bez podawania karty kredytowej",
  "Bez zobowiązań — rezygnujesz jednym kliknięciem",
];

export default function LandingPage() {
  return (
    <div className="landing-shell">
      <div className="landing-glow landing-glow-a" aria-hidden="true" />
      <div className="landing-glow landing-glow-b" aria-hidden="true" />

      <nav className="landing-nav">
        <span className="landing-brand">
          <span className="icon-badge">📊</span>
          <span className="landing-brand-name">Nexus Podatki</span>
        </span>
        <Link href="/login" className="btn btn-ghost landing-nav-cta">
          Zaloguj się
        </Link>
      </nav>

      <header className="landing-hero">
        <span className="landing-badge">AI Doradca podatkowy</span>
        <h1 className="landing-title">Twój doradca podatkowy 24/7</h1>
        <p className="landing-tagline">
          PIT, VAT, ryczałt i wybór formy opodatkowania. Czyta Twoje dokumenty, generuje pisma i umowy —
          i tłumaczy wszystko po ludzku.
        </p>
        <div className="landing-cta-row">
          <Link href="/login" className="btn btn-primary landing-cta-primary">
            🚀 Wypróbuj 7 dni za darmo
          </Link>
          <a href="#demo" className="btn btn-ghost landing-cta-secondary">
            Zobacz jak to działa
          </a>
        </div>
        <p className="landing-hero-note">Bez karty kredytowej · Bez zobowiązań</p>
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
          <h2 className="landing-demo-title">Wgraj fakturę → dostajesz konkretną odpowiedź</h2>
          <p className="landing-demo-desc">
            Bez przekopywania ustaw i interpretacji. Zadaj pytanie tak, jak zadałbyś je księgowemu — agent
            odpowie merytorycznie i podpowie, co zrobić dalej.
          </p>
        </div>

        <div className="landing-demo-window">
          <div className="landing-demo-titlebar">
            <span className="landing-demo-dots">
              <i /> <i /> <i />
            </span>
            <span className="landing-demo-titlebar-label">💬 Czat — Nexus Podatki</span>
          </div>
          <div className="landing-demo-body">
            <div className="landing-chat-bubble landing-chat-bubble--user">
              Prowadzę JDG na liniowym. Czy mogę wrzucić w koszty laptopa za 6 tys.?
            </div>
            <div className="landing-chat-bubble landing-chat-bubble--bot">
              Tak — przy cenie poniżej <strong>10 000 zł</strong> możesz zaliczyć laptopa jednorazowo do kosztów
              w miesiącu zakupu, jeśli służy działalności. Przy użytku mieszanym bezpieczniej rozliczyć część. 💻
            </div>
            <div className="landing-chat-bubble landing-chat-bubble--user">
              Przygotuj mi umowę B2B dla podwykonawcy
            </div>
            <div className="landing-chat-bubble landing-chat-bubble--bot landing-chat-bubble--typing">
              <span /> <span /> <span />
            </div>
          </div>
        </div>
      </section>

      <section className="landing-trial" aria-label="Okres próbny">
        <div className="landing-trial-card">
          <span className="landing-badge">7 dni za darmo</span>
          <h2 className="landing-trial-title">Sprawdź, zanim zapłacisz</h2>
          <p className="landing-trial-desc">
            Przetestuj wszystko — analizę dokumentów, generowanie pism i umów, rozliczenia PIT i VAT.
          </p>
          <ul className="landing-trial-list">
            {TRIAL_POINTS.map((point) => (
              <li key={point}>
                <span aria-hidden="true">✅</span> {point}
              </li>
            ))}
          </ul>
          <Link href="/login" className="btn btn-primary landing-cta-primary">
            Zacznij 7-dniowy okres próbny
          </Link>
        </div>
      </section>

      <section className="landing-cta-footer">
        <h2 className="landing-cta-footer-title">Masz pytanie podatkowe? Zadaj je teraz.</h2>
        <Link href="/login" className="btn btn-primary landing-cta-primary">
          Stwórz konto
        </Link>
        <p className="landing-footer-note">
          7 dni za darmo, bez karty i bez zobowiązań. Anuluj w każdej chwili.
        </p>
        <p className="landing-disclaimer">
          Nexus Podatki wspiera w codziennych rozliczeniach, ale nie zastępuje wiążącej porady prawnej ani
          indywidualnej interpretacji podatkowej.
        </p>
      </section>
    </div>
  );
}
