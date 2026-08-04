"use client";

import { useAuth } from "@/app/lib/auth-context";
import DashboardPage from "@/app/dashboard/page";
import LandingPage from "@/app/components/LandingPage";

// Niezalogowany user widzi landing page, zalogowany trafia od razu do dashboardu
// (patrz W1_LANDING_PAGE.md; ten sam dashboard jest też dostępny pod /dashboard).
export default function Home() {
  const { user } = useAuth();
  return user ? <DashboardPage /> : <LandingPage />;
}
