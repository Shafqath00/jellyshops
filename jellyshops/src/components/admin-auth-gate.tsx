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
  const { configured, loading, merchantLoading, merchantStatus, merchantError, refreshMerchant, session, stores } = useAuth();
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
      merchantStatus === "ready" &&
      stores.length === 0
    ) {
      router.replace("/onboarding");
    }
  }, [
    configured,
    loading,
    merchantLoading,
    merchantStatus,
    pathname,
    router,
    session,
    stores.length,
  ]);

  if (!configured) {
    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden bg-muted/50 p-6 text-foreground">
        <div className="pointer-events-none absolute -left-24 top-24 size-72 rounded-full bg-muted/70 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-16 size-80 rounded-full bg-[var(--warn-bg)]/60 blur-3xl" />

        <section className="relative w-full max-w-md rounded-[28px] border border-black/[0.06] bg-card/80 p-7 text-center shadow-[0_24px_80px_rgba(83,61,66,0.10)] backdrop-blur-xl sm:p-8">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-tint-foreground">
            <AlertCircle size={21} strokeWidth={2} />
          </span>

          <div className="mt-5 inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-tint-foreground">
            <Sparkles size={11} />
            Jelly Shop setup
          </div>

          <h1 className="mt-3 text-[22px] font-black tracking-[-0.04em] text-foreground">
            Connect merchant authentication
          </h1>

          <p className="mx-auto mt-3 max-w-sm text-[12px] leading-6 text-muted-foreground">
            Add your public Supabase URL and anonymous key before opening the
            merchant studio.
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-[11px] font-black text-primary-foreground shadow-[0_10px_28px_rgba(36,31,32,0.16)] transition hover:-translate-y-0.5 hover:bg-primary"
          >
            Back to Jelly Shop
          </Link>
        </section>
      </main>
    );
  }

  if (session && merchantStatus === "error") {
    return <main className="auth-page"><section className="auth-panel auth-message"><p role="alert">{merchantError ?? "Could not load your stores."}</p><button className="button button-primary" onClick={() => { void refreshMerchant().catch(() => {}); }}>Retry loading stores</button></section></main>;
  }

  if (loading || merchantLoading || !session || stores.length === 0) {
    return (
      <main
        className="relative grid min-h-screen place-items-center overflow-hidden bg-muted/50 p-6 text-center text-foreground"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted/45 blur-3xl" />

        <div className="relative flex flex-col items-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-foreground shadow-[inset_0_-2px_0_rgba(36,31,32,0.12)]">
            <LoaderCircle
              size={21}
              strokeWidth={2.3}
              className="animate-spin"
            />
          </span>

          <p className="mt-4 text-[13px] font-black tracking-[-0.02em]">
            Opening your merchant studio
          </p>

          <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
            Getting your store ready…
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
