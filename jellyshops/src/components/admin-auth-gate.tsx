"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, LoaderCircle, Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";

export function AdminAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { configured, loading, merchantLoading, session, stores } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (configured && !loading && !session) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }

    if (
      configured &&
      session &&
      !merchantLoading &&
      stores.length === 0
    ) {
      router.replace("/onboarding");
    }
  }, [
    configured,
    loading,
    merchantLoading,
    pathname,
    router,
    session,
    stores.length,
  ]);

  if (!configured) {
    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#fffaf4] p-6 text-[#241f20]">
        <div className="pointer-events-none absolute -left-24 top-24 size-72 rounded-full bg-[#ffd8df]/70 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-16 size-80 rounded-full bg-[#e9f0b7]/60 blur-3xl" />

        <section className="relative w-full max-w-md rounded-[28px] border border-black/[0.06] bg-white/80 p-7 text-center shadow-[0_24px_80px_rgba(83,61,66,0.10)] backdrop-blur-xl sm:p-8">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#fff0f3] text-[#a35467]">
            <AlertCircle size={21} strokeWidth={2} />
          </span>

          <div className="mt-5 inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#9a5364]">
            <Sparkles size={11} />
            Jelly Shop setup
          </div>

          <h1 className="mt-3 text-[22px] font-black tracking-[-0.04em] text-[#2e2729]">
            Connect merchant authentication
          </h1>

          <p className="mx-auto mt-3 max-w-sm text-[12px] leading-6 text-[#786d70]">
            Add your public Supabase URL and anonymous key before opening the
            merchant studio.
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-[#241f20] px-4 text-[11px] font-black text-white shadow-[0_10px_28px_rgba(36,31,32,0.16)] transition hover:-translate-y-0.5 hover:bg-[#3a3234]"
          >
            Back to Jelly Shop
          </Link>
        </section>
      </main>
    );
  }

  if (loading || merchantLoading || !session || stores.length === 0) {
    return (
      <main
        className="relative grid min-h-screen place-items-center overflow-hidden bg-[#fffaf4] p-6 text-center text-[#241f20]"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffdce4]/45 blur-3xl" />

        <div className="relative flex flex-col items-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#ff8da4] text-[#241f20] shadow-[inset_0_-2px_0_rgba(36,31,32,0.12)]">
            <LoaderCircle
              size={21}
              strokeWidth={2.3}
              className="animate-spin"
            />
          </span>

          <p className="mt-4 text-[13px] font-black tracking-[-0.02em]">
            Opening your merchant studio
          </p>

          <p className="mt-1.5 text-[11px] font-medium text-[#8a7d80]">
            Getting your store ready…
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
