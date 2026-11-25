import type { Metadata } from "next";
import { LegalPage } from "../legal-page";
import { legalDocuments } from "../legal-content";
import { brandViewport } from "@/features/brand/theme";

export const viewport = brandViewport;

export const metadata: Metadata = {
  title: "Privacy Policy | Jellyshop",
  description: legalDocuments.privacy.summary,
  alternates: { canonical: "/legal/privacy" },
};

export default function PrivacyPage() {
  return <LegalPage doc={legalDocuments.privacy} />;
}
