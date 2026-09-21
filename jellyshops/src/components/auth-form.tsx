"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, Store } from "lucide-react";
import { supabase, useAuth } from "@/features/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { configured } = useAuth();
  const router = useRouter();
  const query = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isSignup = mode === "signup";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");

    setPending(true);
    setError("");
    setNotice("");

    const result = isSignup
      ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: String(data.get("name") ?? "") } },
        })
      : await supabase.auth.signInWithPassword({ email, password });

    setPending(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (!result.data.session) {
      setNotice(
        "Check your inbox to confirm your email, then return here to sign in.",
      );
      return;
    }

    router.replace(isSignup ? "/onboarding" : query.get("next") || "/admin");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold"
        >
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Store size={15} />
          </span>
          Jelly Shop
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {isSignup ? "Create your merchant account" : "Welcome back"}
            </CardTitle>
            <CardDescription>
              {isSignup
                ? "Start your store and manage products, orders, and your storefront."
                : "Sign in to manage your Jelly Shop workspace."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {!configured ? (
              <div
                className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm"
                role="alert"
              >
                <strong>Authentication is not configured.</strong>
                <p className="mt-1 text-muted-foreground">
                  Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                  <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable merchant access.
                </p>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={submit}>
                {isSignup && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Your name</Label>
                    <Input id="name" name="name" autoComplete="name" required />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" autoComplete="email" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    minLength={6}
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}

                {notice && (
                  <p className="text-sm text-muted-foreground" role="status">
                    {notice}
                  </p>
                )}

                <Button className="w-full" disabled={pending} type="submit">
                  {pending
                    ? "Working…"
                    : isSignup
                      ? "Create account"
                      : "Sign in"}
                  <ArrowRight />
                </Button>
              </form>
            )}

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isSignup ? "Already have an account?" : "New to Jelly Shop?"}{" "}
              <Link
                className="font-medium text-foreground underline underline-offset-4"
                href={isSignup ? "/login" : "/signup"}
              >
                {isSignup ? "Sign in" : "Create an account"}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
