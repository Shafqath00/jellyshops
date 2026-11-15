import Image from "next/image";
import type { ReactNode } from "react";
import {
  BedDouble, Check, Gem, Headphones, Laptop, Palette, Rocket, Shirt, ShoppingBag, Smartphone, Sofa, Sparkles, Store, Truck, Utensils,
} from "lucide-react";
import { markets, type SellingChannel, type SetupAnswers, type SetupMarket, type SetupStep } from "@/features/auth/api/onboarding-api";
import styles from "./onboarding.module.css";

/**
 * The five steps people see, in order. Each saves under one of the backend's existing
 * step keys (the database only accepts those), so no migration is needed:
 * store = name and web address, business = what you sell, profile = how you sell today,
 * branding = pick a design, products = first product.
 */
export const visibleSteps = ["store", "business", "profile", "branding", "products"] as const satisfies readonly SetupStep[];
export type VisibleStep = typeof visibleSteps[number];

/** Resume on the matching visible step (old keys and "review" land on the nearest one). */
export function visibleStep(step: SetupStep): VisibleStep {
  return (visibleSteps as readonly string[]).includes(step) ? step as VisibleStep : step === "review" ? "products" : "store";
}

export const stepContent: Record<VisibleStep, { label: string; title: string; description: string }> = {
  store: { label: "Your store", title: "Name your store", description: "Pick a name and the web address customers will use. You can change the name later." },
  business: { label: "What you sell", title: "What do you sell?", description: "We’ll suggest a design and set up your first collections to match." },
  profile: { label: "How you sell", title: "How do you sell today?", description: "Choose all that apply. It helps us point you to the right tools first." },
  branding: { label: "Design", title: "Pick a design", description: "Every design is free and fully editable. You can switch any time before you publish." },
  products: { label: "First product", title: "Add your first product", description: "Just the basics for now. You can add photos, sizes and stock details from your dashboard." },
};

/** Placeholder visuals beside each step (the dedicated illustrations are still to be generated). */
export const stepVisual: Record<VisibleStep, string> = {
  store: "/assets/hero-dashboard-storefront.webp",
  business: "/assets/feature-products.webp",
  profile: "/assets/feature-orders.webp",
  branding: "",
  products: "/assets/feature-checkout.webp",
};

export const categories = [
  { id: "Clothing & accessories", icon: Shirt, theme: "jelly-avenue" },
  { id: "Beauty & wellness", icon: Sparkles, theme: "jelly-halo" },
  { id: "Home & living", icon: Sofa, theme: "jelly-forma" },
  { id: "Beds & bedroom", icon: BedDouble, theme: "jelly-resthaven" },
  { id: "Electronics", icon: Headphones, theme: "jelly-diode" },
  { id: "Food & drink", icon: Utensils, theme: "jelly-signature" },
  { id: "Jewellery", icon: Gem, theme: "jelly-signature" },
  { id: "Art & stationery", icon: Palette, theme: "jelly-harbour" },
  { id: "Other", icon: ShoppingBag, theme: "jelly-signature" },
] as const;

export const channels: { id: SellingChannel; label: string; text: string; icon: typeof Store }[] = [
  { id: "starting", label: "I’m just starting", text: "No sales yet", icon: Rocket },
  { id: "own-website", label: "My own website", text: "Another store builder", icon: Laptop },
  { id: "marketplace", label: "Marketplaces", text: "Etsy, eBay, Amazon and others", icon: ShoppingBag },
  { id: "social", label: "Social media", text: "Instagram, TikTok, DMs", icon: Smartphone },
  { id: "in-person", label: "In person", text: "Markets, pop-ups or a shop", icon: Store },
  { id: "wholesale", label: "Wholesale", text: "Selling to other businesses", icon: Truck },
];

export const themes = [
  { id: "jelly-signature", name: "Minimal", fit: "Any shop" },
  { id: "jelly-forma", name: "Forma", fit: "Home and living" },
  { id: "jelly-halo", name: "Halo", fit: "Beauty" },
  { id: "jelly-diode", name: "Diode", fit: "Electronics" },
  { id: "jelly-avenue", name: "Avenue", fit: "Fashion" },
  { id: "jelly-resthaven", name: "Resthaven", fit: "Beds and bedroom" },
  { id: "jelly-harbour", name: "Harbour", fit: "Coastal home" },
] as const;

export const themeCover = (id: string) => `/templates/${id}.webp`;
export const suggestedTheme = (category?: string) => categories.find((item) => item.id === category)?.theme ?? "jelly-signature";

export function slugFromName(value: string) {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-/, "").slice(0, 63).replace(/-$/, "");
}

/** Problems that stop the step from moving on. Steps 2 to 5 are optional apart from a half-filled product. */
export function validateStep(step: SetupStep, answers: SetupAnswers): Record<string, string> {
  const issues: Record<string, string> = {};
  if (step === "store" || step === "review") {
    if (!answers.fullName?.trim()) issues.fullName = "Enter your name.";
    if (!answers.name?.trim()) issues.name = "Enter a store name.";
    const slug = answers.slug ?? "";
    if (slug.length < 3 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) issues.slug = "Use 3–63 lowercase letters, numbers and single hyphens.";
    if (!answers.country || !markets[answers.country]) issues.country = "Choose where your business is based.";
  }
  if ((step === "products" || step === "review") && answers.product && Object.values(answers.product).some((value) => value !== undefined && value !== "")) {
    if (!answers.product.title?.trim()) issues.productTitle = "Enter a product name, or skip this step.";
    if (answers.product.priceMinor === undefined) issues.productPrice = "Enter a price, for example 24 or 24.50.";
  }
  return issues;
}

type SetupFieldsProps = {
  step: VisibleStep;
  answers: SetupAnswers;
  change: (patch: Partial<SetupAnswers>) => void;
  changeSlug: (slug: string) => void;
  fieldErrors: Record<string, string>;
  addressState: "checking" | "available" | "taken" | "error" | null;
  logo: ReactNode;
};

function Field({ field, label, optional, hint, error, children }: {
  field: string; label: string; optional?: boolean; hint?: string; error?: string; children: ReactNode;
}) {
  return (
    <div className={styles.field} data-invalid={Boolean(error) || undefined}>
      <label htmlFor={`onboard-${field}`}>{label}{optional && <span> (optional)</span>}</label>
      {children}
      {hint && <p className={styles.hint} id={`onboard-${field}-hint`}>{hint}</p>}
      {error && <p className={styles.error} role="alert" id={`onboard-${field}-error`}>{error}</p>}
    </div>
  );
}

export function SetupFields({ step, answers, change, changeSlug, fieldErrors, addressState, logo }: SetupFieldsProps) {
  const attrs = (id: string, hint = false) => ({
    id: `onboard-${id}`,
    "aria-invalid": Boolean(fieldErrors[id]) || undefined,
    "aria-describedby": [fieldErrors[id] ? `onboard-${id}-error` : "", hint ? `onboard-${id}-hint` : ""].filter(Boolean).join(" ") || undefined,
  });
  const currency = answers.country ? markets[answers.country].currency : "";

  switch (step) {
    case "store":
      return <>
        <Field field="name" label="Store name" error={fieldErrors.name}>
          <input {...attrs("name")} className={styles.input} required maxLength={120} placeholder="Fern Studio" autoComplete="organization"
            value={answers.name ?? ""} onChange={(event) => change({ name: event.target.value })} />
        </Field>
        <Field field="slug" label="Store web address" hint="Lowercase letters, numbers and hyphens." error={fieldErrors.slug}>
          <div className={styles.slugField}>
            <span aria-hidden="true">jelly.shop/</span>
            <input {...attrs("slug", true)} required maxLength={63} autoCapitalize="none" spellCheck={false}
              value={answers.slug ?? ""} onChange={(event) => changeSlug(event.target.value.toLowerCase())} />
          </div>
          <p role="status" className={styles.address} data-state={addressState ?? undefined}>
            {addressState === "checking" ? "Checking it’s free…" : addressState === "available" ? <><Check size={14} aria-hidden="true" /> This address is free.</>
              : addressState === "taken" ? "This address is taken. Try another." : addressState === "error" ? "We couldn’t check it now. We’ll check again when you create your store." : ""}
          </p>
        </Field>
        <div className={styles.inlineFields}>
          <Field field="fullName" label="Your name" error={fieldErrors.fullName}>
            <input {...attrs("fullName")} className={styles.input} required autoComplete="name" maxLength={120}
              value={answers.fullName ?? ""} onChange={(event) => change({ fullName: event.target.value })} />
          </Field>
          <Field field="country" label="Where you’re based" error={fieldErrors.country}>
            <select {...attrs("country")} className={styles.input} required value={answers.country ?? ""} onChange={(event) => change({ country: event.target.value as SetupMarket | "" })}>
              <option value="">Choose a country</option>
              {Object.entries(markets).map(([country, market]) => <option key={country} value={country}>{market.label} · {market.currency}</option>)}
            </select>
          </Field>
        </div>
        <p className={styles.hint}>Your country sets the currency shoppers pay in. It can’t be changed after your store is created.</p>
      </>;
    case "business":
      return <>
        <fieldset className={styles.group}>
          <legend>Pick the closest match</legend>
          <div className={styles.tiles}>
            {categories.map(({ id, icon: Icon }) => (
              <label key={id} className={styles.tile}>
                <input type="radio" name="category" value={id} checked={answers.category === id} onChange={() => change({ category: id })} />
                <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                <span>{id}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field field="productCategories" label="Your first collections" optional hint="Up to five, separated by commas. For example: Mugs, Vases, Gift sets.">
          <input id="onboard-productCategories" className={styles.input} aria-describedby="onboard-productCategories-hint" maxLength={300}
            defaultValue={(answers.productCategories ?? []).join(", ")}
            onChange={(event) => change({ productCategories: event.target.value.split(",").map((item) => item.trim().slice(0, 60)).filter(Boolean).slice(0, 5) })} />
        </Field>
      </>;
    case "profile": {
      const selected = new Set(answers.sellingChannels ?? []);
      return (
        <fieldset className={styles.group}>
          <legend>Choose all that apply</legend>
          <div className={styles.options}>
            {channels.map(({ id, label, text, icon: Icon }) => (
              <label key={id} className={styles.option}>
                <input type="checkbox" checked={selected.has(id)} onChange={(event) => {
                  const next = new Set(selected);
                  if (event.target.checked) next.add(id); else next.delete(id);
                  if (id === "starting" && event.target.checked) for (const other of channels) if (other.id !== "starting") next.delete(other.id);
                  if (id !== "starting" && event.target.checked) next.delete("starting");
                  change({ sellingChannels: channels.map((item) => item.id).filter((item) => next.has(item)) });
                }} />
                <span className={styles.optionIcon}><Icon size={18} strokeWidth={1.5} aria-hidden="true" /></span>
                <span><strong>{label}</strong><small>{text}</small></span>
                <span className={styles.optionCheck} aria-hidden="true"><Check size={14} strokeWidth={2} /></span>
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
    case "branding": {
      const suggested = suggestedTheme(answers.category);
      const chosen = answers.theme ?? suggested;
      return <>
        <fieldset className={styles.group}>
          <legend>Store designs</legend>
          <div className={styles.designs}>
            {[...themes].sort((a, b) => Number(b.id === suggested) - Number(a.id === suggested)).map((theme) => (
              <label key={theme.id} className={styles.design}>
                <input type="radio" name="theme" value={theme.id} checked={chosen === theme.id} onChange={() => change({ theme: theme.id })} />
                <span className={styles.designImage}><Image src={themeCover(theme.id)} width={480} height={320} alt="" sizes="(max-width: 639px) 44vw, 220px" /></span>
                <span className={styles.designMeta}>
                  <strong>{theme.name}</strong>
                  <small>{theme.id === suggested && answers.category ? "Suggested for you" : theme.fit}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className={styles.upload}>{logo}</div>
      </>;
    }
    case "products": {
      const product = answers.product ?? {};
      return <>
        <Field field="productTitle" label="Product name" error={fieldErrors.productTitle}>
          <input {...attrs("productTitle")} className={styles.input} maxLength={120} placeholder="Speckled stoneware mug"
            value={product.title ?? ""} onChange={(event) => change({ product: { ...product, title: event.target.value } })} />
        </Field>
        <div className={styles.inlineFields}>
          <Field field="productPrice" label={currency ? `Price (${currency})` : "Price"} error={fieldErrors.productPrice}>
            <PriceInput {...attrs("productPrice")} value={product.priceMinor} onChange={(priceMinor) => change({ product: { ...product, priceMinor } })} />
          </Field>
          <Field field="stock" label="How many you have" optional>
            <input {...attrs("stock")} className={styles.input} type="number" inputMode="numeric" min={0} max={1_000_000} step={1} placeholder="12"
              value={product.stock ?? ""} onChange={(event) => {
                const value = event.target.valueAsNumber;
                change({ product: { ...product, stock: Number.isInteger(value) && value >= 0 && value <= 1_000_000 ? value : undefined } });
              }} />
          </Field>
        </div>
        <p className={styles.hint}>It’s saved as a draft, so shoppers won’t see it until you’re ready.</p>
      </>;
    }
  }
}

function PriceInput({ value, onChange, ...props }: { id: string; value?: number; onChange: (value?: number) => void }) {
  return <input {...props} className={styles.input} inputMode="decimal" placeholder="24.00" defaultValue={value === undefined ? "" : (value / 100).toFixed(2)} maxLength={12}
    onChange={(event) => {
      const amount = event.target.value.trim();
      onChange(/^\d{1,7}(?:\.\d{0,2})?$/.test(amount) ? Math.round(Number(amount) * 100) : undefined);
    }} />;
}
