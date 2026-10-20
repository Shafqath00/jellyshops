import { CustomerPage } from "@/features/customers/customer-page";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "customer register", robots: { index: false, follow: false } };
export default function Page() { return <CustomerPage kind="customer-register" />; }
