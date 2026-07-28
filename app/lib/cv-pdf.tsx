"use client";

import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
import type { CVData, CVTheme } from "@/app/lib/cv-schema";

// Domyślne fonty PDF (Helvetica itp.) nie obsługują polskich znaków diakrytycznych
// (WinAnsi encoding) — rejestrujemy Roboto (Latin Extended) z lokalnych plików w /public/fonts,
// żeby PDF działał offline i nie zależał od zewnętrznego CDN w czasie generowania.
let fontsRegistered = false;
function ensureFontsRegistered() {
  if (fontsRegistered) return;
  Font.register({
    family: "Roboto",
    fonts: [
      { src: "/fonts/Roboto-Regular.ttf", fontWeight: "normal" },
      { src: "/fonts/Roboto-Bold.ttf", fontWeight: "bold" },
      { src: "/fonts/Roboto-Italic.ttf", fontStyle: "italic" },
    ],
  });
  fontsRegistered = true;
}

const styles = StyleSheet.create({
  page: {
    flexDirection: "row",
    fontFamily: "Roboto",
    fontSize: 9.5,
    color: "#1f2937",
  },
  sidebar: {
    width: "34%",
    padding: 20,
    paddingTop: 28,
  },
  main: {
    width: "66%",
    padding: 24,
    paddingTop: 28,
  },
  photo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 16,
    objectFit: "cover",
  },
  sidebarSectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sidebarLine: {
    fontSize: 9,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  tag: {
    fontSize: 8.5,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 3,
    marginRight: 4,
    marginBottom: 4,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  name: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 2,
  },
  jobTitle: {
    fontSize: 11.5,
    marginBottom: 14,
  },
  mainSectionTitle: {
    fontSize: 11.5,
    fontWeight: "bold",
    marginTop: 14,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    borderBottomWidth: 1.5,
    paddingBottom: 4,
  },
  summaryText: {
    fontSize: 9.5,
    lineHeight: 1.5,
  },
  expItem: {
    marginBottom: 10,
  },
  expHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 1,
  },
  expRole: {
    fontSize: 10,
    fontWeight: "bold",
  },
  expPeriod: {
    fontSize: 8.5,
    color: "#6b7280",
  },
  expCompany: {
    fontSize: 9.5,
    fontStyle: "italic",
    marginBottom: 3,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 2,
    paddingLeft: 2,
  },
  bulletDot: {
    fontSize: 9,
    marginRight: 5,
  },
  bulletText: {
    fontSize: 9,
    lineHeight: 1.4,
    flex: 1,
  },
  eduItem: {
    marginBottom: 8,
  },
  eduSchool: {
    fontSize: 10,
    fontWeight: "bold",
  },
  eduDegree: {
    fontSize: 9,
  },
  eduPeriod: {
    fontSize: 8.5,
    color: "#6b7280",
  },
});

type CVDocumentProps = {
  data: CVData;
  theme: CVTheme;
  photoDataUrl?: string | null;
};

export function CVDocument({ data, theme, photoDataUrl }: CVDocumentProps) {
  ensureFontsRegistered();

  const hasContact =
    data.contact.email || data.contact.phone || data.contact.location || data.contact.linkedin || data.contact.website;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.sidebar, { backgroundColor: theme.accentSoft }]}>
          {photoDataUrl && <Image src={photoDataUrl} style={styles.photo} />}

          {hasContact && (
            <>
              <Text style={[styles.sidebarSectionTitle, { color: theme.accent }]}>Kontakt</Text>
              {data.contact.email && <Text style={styles.sidebarLine}>{data.contact.email}</Text>}
              {data.contact.phone && <Text style={styles.sidebarLine}>{data.contact.phone}</Text>}
              {data.contact.location && <Text style={styles.sidebarLine}>{data.contact.location}</Text>}
              {data.contact.linkedin && <Text style={styles.sidebarLine}>{data.contact.linkedin}</Text>}
              {data.contact.website && <Text style={styles.sidebarLine}>{data.contact.website}</Text>}
            </>
          )}

          {data.skills.length > 0 && (
            <>
              <Text style={[styles.sidebarSectionTitle, { color: theme.accent }]}>Umiejętności</Text>
              <View style={styles.tagRow}>
                {data.skills.map((skill, i) => (
                  <Text key={i} style={[styles.tag, { backgroundColor: "#ffffff", color: theme.accent }]}>
                    {skill}
                  </Text>
                ))}
              </View>
            </>
          )}

          {data.languages.length > 0 && (
            <>
              <Text style={[styles.sidebarSectionTitle, { color: theme.accent }]}>Języki</Text>
              {data.languages.map((l, i) => (
                <Text key={i} style={styles.sidebarLine}>
                  {l.language} - {l.level}
                </Text>
              ))}
            </>
          )}

          {data.interests.length > 0 && (
            <>
              <Text style={[styles.sidebarSectionTitle, { color: theme.accent }]}>Zainteresowania</Text>
              <View style={styles.tagRow}>
                {data.interests.map((interest, i) => (
                  <Text key={i} style={[styles.tag, { backgroundColor: "#ffffff", color: theme.accent }]}>
                    {interest}
                  </Text>
                ))}
              </View>
            </>
          )}
        </View>

        <View style={styles.main}>
          <Text style={[styles.name, { color: theme.accent }]}>{data.fullName}</Text>
          {data.jobTitle && <Text style={styles.jobTitle}>{data.jobTitle}</Text>}

          {data.summary && (
            <>
              <Text style={[styles.mainSectionTitle, { color: theme.accent, borderBottomColor: theme.accent }]}>
                Profil zawodowy
              </Text>
              <Text style={styles.summaryText}>{data.summary}</Text>
            </>
          )}

          {data.experience.length > 0 && (
            <>
              <Text style={[styles.mainSectionTitle, { color: theme.accent, borderBottomColor: theme.accent }]}>
                Doświadczenie zawodowe
              </Text>
              {data.experience.map((exp, i) => (
                <View key={i} style={styles.expItem} wrap={false}>
                  <View style={styles.expHeaderRow}>
                    <Text style={styles.expRole}>{exp.role}</Text>
                    {exp.period && <Text style={styles.expPeriod}>{exp.period}</Text>}
                  </View>
                  <Text style={styles.expCompany}>{exp.company}</Text>
                  {exp.bullets.map((bullet, j) => (
                    <View key={j} style={styles.bulletRow}>
                      <Text style={[styles.bulletDot, { color: theme.accent }]}>•</Text>
                      <Text style={styles.bulletText}>{bullet}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </>
          )}

          {data.education.length > 0 && (
            <>
              <Text style={[styles.mainSectionTitle, { color: theme.accent, borderBottomColor: theme.accent }]}>
                Edukacja
              </Text>
              {data.education.map((edu, i) => (
                <View key={i} style={styles.eduItem} wrap={false}>
                  <View style={styles.expHeaderRow}>
                    <Text style={styles.eduSchool}>{edu.school}</Text>
                    {edu.period && <Text style={styles.eduPeriod}>{edu.period}</Text>}
                  </View>
                  {edu.degree && <Text style={styles.eduDegree}>{edu.degree}</Text>}
                </View>
              ))}
            </>
          )}
        </View>
      </Page>
    </Document>
  );
}
