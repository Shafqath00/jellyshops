"use client";

import { useEffect, useState } from "react";
import { AdminPage, Banner, Card, CardSkeleton, Field, ResourceForm, useToast } from "@/components/admin";
import { setupRequest, type AccountProfile } from "@/features/auth/api/onboarding-api";
import { SetupImageControl, useSetupImage } from "@/features/auth/components/setup-images";
import { authApiOrigin, useAuth } from "@/features/auth/providers/auth-provider";

export default function AccountProfilePage() {
  const { getAccessToken, session } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [draft, setDraft] = useState<Pick<AccountProfile, "fullName" | "bio"> | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const owner = session?.user.id;
  const photo = useSetupImage("profile", Boolean(profile?.hasImage));
  const current = draft ?? profile;

  useEffect(() => {
    if (!owner) return;
    const controller = new AbortController();
    void getAccessToken().then((token) => setupRequest<AccountProfile>(authApiOrigin(), "/profile", token, {
      signal: controller.signal,
    })).then((value) => {
      if (!controller.signal.aborted) { setProfile(value); setError(""); }
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load your profile.");
    });
    return () => controller.abort();
  }, [attempt, getAccessToken, owner]);

  return <AdminPage title="Account profile" width="narrow" description="Manage your personal JellyShop details." back={{ href: "/admin/settings", label: "Settings" }}>
    {error && <Banner tone="critical" title="Could not load your profile" action={<button type="button" className="jk-button" onClick={() => setAttempt((value) => value + 1)}>Try again</button>}>{error}</Banner>}
    {!profile || !current ? !error && <CardSkeleton label="Loading profile" /> : <>
      <ResourceForm dirty={Boolean(draft && (draft.fullName !== profile.fullName || draft.bio !== profile.bio))} onDiscard={() => setDraft(null)} onSubmit={async () => {
        const next = await setupRequest<AccountProfile>(authApiOrigin(), "/profile", await getAccessToken(), {
          method: "PATCH", body: { fullName: current.fullName.trim(), bio: current.bio.trim() },
        });
        setProfile(next);
        setDraft(null);
        toast("Profile saved");
      }}>
        <Card title="Personal details">
          <div className="jk-stack-sm">
            <Field id="full-name" label="Full name"><input id="full-name" required autoComplete="name" maxLength={120} value={current.fullName} onChange={(event) => setDraft({ fullName: event.target.value, bio: current.bio })} /></Field>
            <Field id="account-email" label="Account email"><input id="account-email" type="email" value={profile.email} readOnly /></Field>
            <Field id="profile-bio" label="Bio"><textarea id="profile-bio" rows={3} maxLength={500} value={current.bio} onChange={(event) => setDraft({ fullName: current.fullName, bio: event.target.value })} /></Field>
          </div>
        </Card>
      </ResourceForm>
      <Card title="Profile photo">
        <p className="jk-muted">Your profile photo is private.</p>
        <SetupImageControl kind="profile" title="Profile photo" picture={photo} present={profile.hasImage}
          onUpdate={(hasImage) => setProfile((value) => value && { ...value, hasImage })} />
      </Card>
    </>}
  </AdminPage>;
}
