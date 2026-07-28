import type { CVData, CVTheme } from "@/app/lib/cv-schema";

type CVPreviewProps = {
  data: CVData;
  theme: CVTheme;
  photoUrl?: string | null;
};

const sidebarTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  marginTop: 20,
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const mainTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  marginTop: 18,
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  paddingBottom: 5,
};

const tag: React.CSSProperties = {
  fontSize: 11,
  padding: "3px 9px",
  borderRadius: 4,
  background: "#fff",
  marginRight: 6,
  marginBottom: 6,
  display: "inline-block",
};

export default function CVPreview({ data, theme, photoUrl }: CVPreviewProps) {
  const hasContact =
    data.contact.email || data.contact.phone || data.contact.location || data.contact.linkedin || data.contact.website;

  return (
    <div
      style={{
        display: "flex",
        background: "#fff",
        color: "#1f2937",
        borderRadius: 4,
        overflow: "hidden",
        boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        minHeight: 700,
      }}
    >
      <div style={{ width: "34%", background: theme.accentSoft, padding: "28px 22px" }}>
        {photoUrl && (
          <img
            src={photoUrl}
            alt="Zdjęcie"
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              objectFit: "cover",
              marginBottom: 16,
              display: "block",
            }}
          />
        )}

        {hasContact && (
          <>
            <div style={{ ...sidebarTitle, color: theme.accent }}>Kontakt</div>
            {data.contact.email && <div style={{ fontSize: 12, marginBottom: 4 }}>{data.contact.email}</div>}
            {data.contact.phone && <div style={{ fontSize: 12, marginBottom: 4 }}>{data.contact.phone}</div>}
            {data.contact.location && <div style={{ fontSize: 12, marginBottom: 4 }}>{data.contact.location}</div>}
            {data.contact.linkedin && <div style={{ fontSize: 12, marginBottom: 4 }}>{data.contact.linkedin}</div>}
            {data.contact.website && <div style={{ fontSize: 12, marginBottom: 4 }}>{data.contact.website}</div>}
          </>
        )}

        {data.skills.length > 0 && (
          <>
            <div style={{ ...sidebarTitle, color: theme.accent }}>Umiejętności</div>
            <div>
              {data.skills.map((skill, i) => (
                <span key={i} style={{ ...tag, color: theme.accent }}>
                  {skill}
                </span>
              ))}
            </div>
          </>
        )}

        {data.languages.length > 0 && (
          <>
            <div style={{ ...sidebarTitle, color: theme.accent }}>Języki</div>
            {data.languages.map((l, i) => (
              <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
                {l.language} - {l.level}
              </div>
            ))}
          </>
        )}

        {data.interests.length > 0 && (
          <>
            <div style={{ ...sidebarTitle, color: theme.accent }}>Zainteresowania</div>
            <div>
              {data.interests.map((interest, i) => (
                <span key={i} style={{ ...tag, color: theme.accent }}>
                  {interest}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ width: "66%", padding: "32px 28px" }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: theme.accent, marginBottom: 2 }}>{data.fullName}</div>
        {data.jobTitle && <div style={{ fontSize: 14, marginBottom: 16 }}>{data.jobTitle}</div>}

        {data.summary && (
          <>
            <div style={{ ...mainTitle, color: theme.accent, borderBottom: `1.5px solid ${theme.accent}` }}>
              Profil zawodowy
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>{data.summary}</div>
          </>
        )}

        {data.experience.length > 0 && (
          <>
            <div style={{ ...mainTitle, color: theme.accent, borderBottom: `1.5px solid ${theme.accent}` }}>
              Doświadczenie zawodowe
            </div>
            {data.experience.map((exp, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{exp.role}</span>
                  {exp.period && <span style={{ fontSize: 11, color: "#6b7280" }}>{exp.period}</span>}
                </div>
                <div style={{ fontSize: 12.5, fontStyle: "italic", marginBottom: 4 }}>{exp.company}</div>
                {exp.bullets.map((bullet, j) => (
                  <div key={j} style={{ display: "flex", gap: 6, marginBottom: 2, paddingLeft: 2 }}>
                    <span style={{ color: theme.accent }}>•</span>
                    <span style={{ fontSize: 12, lineHeight: 1.45 }}>{bullet}</span>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}

        {data.education.length > 0 && (
          <>
            <div style={{ ...mainTitle, color: theme.accent, borderBottom: `1.5px solid ${theme.accent}` }}>
              Edukacja
            </div>
            {data.education.map((edu, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{edu.school}</span>
                  {edu.period && <span style={{ fontSize: 11, color: "#6b7280" }}>{edu.period}</span>}
                </div>
                {edu.degree && <div style={{ fontSize: 12.5 }}>{edu.degree}</div>}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
