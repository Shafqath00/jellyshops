"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AdminPage, Banner, Button, Card, Field } from "@/components/admin";
import { markets, type SetupMarket } from "@/features/auth/api/onboarding-api";
import { authApiOrigin, useAuth } from "@/features/auth/providers/auth-provider";
import { createStore, isAddressFree, newStoreProblems, slugFromName, type NewStoreInput } from "./new-store-api";

/** Designs a new store can start with. Empty id = choose later in Online Store. */
export const NEW_STORE_DESIGNS = [
  { id: "", name: "Choose later", fit: "Start empty and pick a design in Online Store" },
  { id: "jelly-signature", name: "Minimal", fit: "Any shop" },
  { id: "jelly-avenue", name: "Avenue", fit: "Fashion" },
  { id: "jelly-forma", name: "Forma", fit: "Home and living" },
  { id: "jelly-halo", name: "Halo", fit: "Beauty" },
  { id: "jelly-diode", name: "Diode", fit: "Electronics" },
  { id: "jelly-resthaven", name: "Resthaven", fit: "Beds and bedroom" },
] as const;

type AddressState = "idle" | "checking" | "free" | "taken" | "error";

/** "Add another store": a merchant who already has a store creates a second one without going through onboarding. */
export function NewStoreForm() {
  const router = useRouter();
  const { getAccessToken, refreshMerchant, setActiveStoreId, activeStore } = useAuth();
  const startCountry: SetupMarket = activeStore && activeStore.country in markets ? activeStore.country as SetupMarket : "GB";
  const [input, setInput] = useState<NewStoreInput>({ name: "", slug: "", country: startCountry, design: "" });
  const [slugEdited, setSlugEdited] = useState(false);
  const [checked, setChecked] = useState<{ slug: string; state: AddressState }>({ slug: "", state: "idle" });
  const slugValid = !newStoreProblems(input).slug;
  const address: AddressState = slugValid && checked.slug === input.slug ? checked.state : "idle";
  const [shown, setShown] = useState<Partial<Record<keyof NewStoreInput, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slugValid) return;
    const slug = input.slug;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setChecked({ slug, state: "checking" });
      void getAccessToken().then((token) => isAddressFree(authApiOrigin(), token, slug, controller.signal))
        .then((free) => { if (!controller.signal.aborted) setChecked({ slug, state: free ? "free" : "taken" }); })
        .catch(() => { if (!controller.signal.aborted) setChecked({ slug, state: "error" }); });
    }, 350);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [getAccessToken, input.slug, slugValid]);

  const change = (patch: Partial<NewStoreInput>) => setInput((current) => {
    const next = { ...current, ...patch };
    if (patch.name !== undefined && !slugEdited) next.slug = slugFromName(patch.name);
    return next;
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problems = newStoreProblems(input);
    if (address === "taken") problems.slug = "That web address is taken. Choose another.";
    setShown(problems);
    if (Object.keys(problems).length) return;
    setBusy(true); setError(null);
    try {
      const token = await getAccessToken();
      const { store, designInstalled } = await createStore(authApiOrigin(), token, input);
      await refreshMerchant();
      setActiveStoreId(store.id);
      router.push(designInstalled || !input.design ? "/admin?welcome=1" : "/admin/online-store");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not create the store. Try again.");
      setBusy(false);
    }
  }

  const addressHelp = { idle: "Your store will be at jelly.shop/" + (input.slug || "your-store"), checking: "Checking…", free: `jelly.shop/${input.slug} is free.`, taken: "", error: "Could not check the address. You can still try." }[address];
  return <AdminPage title="Add another store" description="Create a separate store with its own products, orders and design. You can switch between stores from the sidebar." back={{ href: "/admin", label: "Home" }} width="narrow">
    <form onSubmit={submit} noValidate className="jk-stack">
      {error && <Banner tone="critical" title="The store was not created">{error}</Banner>}
      <Card title="Store details">
        <div className="jk-stack">
          <Field id="new-store-name" label="Store name" required error={shown.name}>
            <input id="new-store-name" className="jk-input" value={input.name} maxLength={120} autoComplete="organization" onChange={(event) => change({ name: event.target.value })} />
          </Field>
          <Field id="new-store-slug" label="Web address" required help={address === "taken" ? undefined : addressHelp} error={shown.slug ?? (address === "taken" ? "That web address is taken. Choose another." : undefined)}>
            <input id="new-store-slug" className="jk-input" value={input.slug} maxLength={40} autoCapitalize="none" spellCheck={false} onChange={(event) => { setSlugEdited(true); change({ slug: event.target.value.toLowerCase() }); }} />
          </Field>
          <Field id="new-store-country" label="Where the business is based" required help={`Prices will be in ${markets[input.country].currency}. This cannot be changed later.`} error={shown.country}>
            <select id="new-store-country" className="jk-input" value={input.country} onChange={(event) => change({ country: event.target.value as SetupMarket })}>
              {(Object.keys(markets) as SetupMarket[]).map((code) => <option key={code} value={code}>{markets[code].label}</option>)}
            </select>
          </Field>
        </div>
      </Card>
      <Card title="Start with a design" description="You can change or edit the design later in Online Store.">
        <fieldset className="jk-new-store-designs">
          <legend className="sr-only">Design</legend>
          {NEW_STORE_DESIGNS.map((design) => <label key={design.id || "later"} className="jk-new-store-design">
            <input type="radio" name="design" value={design.id} checked={input.design === design.id} onChange={() => change({ design: design.id })} />
            <span><strong>{design.name}</strong><small>{design.fit}</small></span>
          </label>)}
        </fieldset>
      </Card>
      <div className="jk-new-store-actions">
        <Button variant="secondary" onClick={() => router.push("/admin")} disabled={busy}>Cancel</Button>
        <Button type="submit" variant="primary" loading={busy} loadingLabel="Creating store…">Create store</Button>
      </div>
    </form>
  </AdminPage>;
}
