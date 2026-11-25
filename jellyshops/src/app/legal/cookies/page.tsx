import type { Metadata } from "next";
import { LegalPage } from "../legal-page";
import { legalDocuments } from "../legal-content";
import { brandViewport } from "@/features/brand/theme";

export const viewport = brandViewport;

export const metadata: Metadata = {
  title: "Cookie Policy | Jellyshop",
  description: legalDocuments.cookies.summary,
  alternates: { canonical: "/legal/cookies" },
};

export default function CookiesPage() {
  return <LegalPage doc={legalDocuments.cookies} />;
}
