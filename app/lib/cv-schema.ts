import { z } from "zod";

export const cvSchema = z.object({
  fullName: z.string().describe("Imię i nazwisko"),
  jobTitle: z
    .string()
    .describe("Tytuł zawodowy / stanowisko, dopasowany do docelowej branży, np. 'Specjalista ds. Marketingu Cyfrowego'"),
  summary: z
    .string()
    .describe("Zwięzły profil zawodowy, 3-5 zdań, dopasowany do docelowej branży"),
  contact: z.object({
    email: z.string().optional().describe("Adres email, jeśli podany w danych osobowych"),
    phone: z.string().optional().describe("Numer telefonu, jeśli podany"),
    location: z.string().optional().describe("Miasto / lokalizacja, jeśli podana"),
    linkedin: z.string().optional().describe("Profil LinkedIn, jeśli podany"),
    website: z.string().optional().describe("Strona www / portfolio, jeśli podane"),
  }),
  skills: z.array(z.string()).describe("Lista umiejętności, pojedyncze krótkie hasła"),
  languages: z
    .array(z.object({ language: z.string(), level: z.string() }))
    .describe("Języki obce z poziomem znajomości, np. { language: 'Angielski', level: 'C1' }"),
  education: z
    .array(
      z.object({
        school: z.string(),
        degree: z.string().optional().describe("Kierunek / tytuł, jeśli podany"),
        period: z.string().optional().describe("Okres nauki, jeśli podany"),
      })
    )
    .describe("Wykształcenie, od najnowszego"),
  experience: z
    .array(
      z.object({
        company: z.string(),
        role: z.string(),
        period: z.string().optional().describe("Okres zatrudnienia, jeśli podany"),
        bullets: z.array(z.string()).describe("Punkty opisujące obowiązki/osiągnięcia, zaczynające się od czasownika"),
      })
    )
    .describe("Doświadczenie zawodowe, od najnowszego"),
  interests: z.array(z.string()).describe("Zainteresowania, pojedyncze krótkie hasła"),
});

export type CVData = z.infer<typeof cvSchema>;

export type CVTheme = {
  id: string;
  label: string;
  accent: string;
  accentSoft: string;
};

export const CV_THEMES: CVTheme[] = [
  { id: "indigo", label: "Indygo", accent: "#4338ca", accentSoft: "#eef2ff" },
  { id: "teal", label: "Turkusowy", accent: "#0f766e", accentSoft: "#ecfdf5" },
  { id: "burgundy", label: "Bordowy", accent: "#9f1239", accentSoft: "#fdf2f4" },
  { id: "graphite", label: "Grafitowy", accent: "#374151", accentSoft: "#f3f4f6" },
  { id: "amber", label: "Bursztynowy", accent: "#b45309", accentSoft: "#fffbeb" },
];

/** Usuwa długie myślniki (—) ze wszystkich pól tekstowych — model czasem ich używa mimo instrukcji */
export function sanitizeCV(cv: CVData): CVData {
  const clean = (s: string) => s.replace(/\s*—\s*/g, ", ").replace(/–/g, "-");

  return {
    ...cv,
    fullName: clean(cv.fullName),
    jobTitle: clean(cv.jobTitle),
    summary: clean(cv.summary),
    contact: Object.fromEntries(
      Object.entries(cv.contact).map(([k, v]) => [k, typeof v === "string" ? clean(v) : v])
    ) as CVData["contact"],
    skills: cv.skills.map(clean),
    languages: cv.languages.map((l) => ({ language: clean(l.language), level: clean(l.level) })),
    education: cv.education.map((e) => ({
      school: clean(e.school),
      degree: e.degree ? clean(e.degree) : e.degree,
      period: e.period ? clean(e.period) : e.period,
    })),
    experience: cv.experience.map((e) => ({
      company: clean(e.company),
      role: clean(e.role),
      period: e.period ? clean(e.period) : e.period,
      bullets: e.bullets.map(clean),
    })),
    interests: cv.interests.map(clean),
  };
}
