import type { Metadata } from "next";
import { LegalPage } from "../legal-page";
import { legalDocuments } from "../legal-content";
import { brandViewport } from "@/features/brand/theme";

export const viewport = brandViewport;

export const metadata: Metadata = {
  title: "Terms of Service | Jellyshop",
  description: legalDocuments.terms.summary,
  alternates: { canonical: "/legal/terms" },
};

export default function TermsPage() {
  return <LegalPage doc={legalDocuments.terms} />;
}
