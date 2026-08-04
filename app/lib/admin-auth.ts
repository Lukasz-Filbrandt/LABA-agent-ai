const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

/** Czy podany email ma dostęp do panelu bezpieczeństwa (/admin/security, patrz W4_PANEL_BEZPIECZENSTWA.md) */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
