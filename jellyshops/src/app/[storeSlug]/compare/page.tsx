import { ComparePage } from "@/features/storefront/components/compare-page";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Compare products", robots: { index: false, follow: false } };
export default function Page() { return <ComparePage />; }
