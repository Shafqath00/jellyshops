import { redirect } from "next/navigation";

/** The old demo set-up page. New stores are set up at /onboarding; anyone who still has this address goes to Home. */
export default function AdminOnboardingPage() {
  redirect("/admin");
}
