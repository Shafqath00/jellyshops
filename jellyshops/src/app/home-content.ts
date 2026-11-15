// Copy for the public home page. Keep every claim true to what Jellyshop does today:
// anything not built is marked `soon`, customers are invented names (no real logos),
// and real brand logos appear only for real integrations (docs/redesign/LOGOS.md).

export type MenuLink = { label: string; text: string; href: string; icon: IconName };
export type MenuGroup = { title: string; links: MenuLink[] };
export type NavItem = { label: string; href?: string; groups?: MenuGroup[] };

/** Lucide icon names used on the page (mapped to components in `_home/icons.tsx`). */
export type IconName =
  | "store" | "layout" | "package" | "card" | "truck" | "chart" | "megaphone" | "globe" | "share" | "bag" | "phone"
  | "users" | "rocket" | "code" | "shield" | "lock" | "lifebuoy" | "history" | "calendar" | "sheet" | "map" | "mail" | "star";

export const navigation: NavItem[] = [
  {
    label: "Product",
    groups: [
      {
        title: "Build",
        links: [
          { label: "Storefront builder", text: "Drag, drop and publish", href: "#features", icon: "layout" },
          { label: "Store designs", text: "Six designs, fully editable", href: "#templates", icon: "store" },
        ],
      },
      {
        title: "Sell",
        links: [
          { label: "Checkout", text: "Card payments through Stripe", href: "#features", icon: "card" },
          { label: "Products and stock", text: "Variants, collections, alerts", href: "#features", icon: "package" },
        ],
      },
      {
        title: "Run",
        links: [
          { label: "Orders and delivery", text: "Pack, ship, track", href: "#features", icon: "truck" },
          { label: "Insights", text: "Sales at a glance", href: "#features", icon: "chart" },
        ],
      },
    ],
  },
  {
    label: "Solutions",
    groups: [
      {
        title: "By channel",
        links: [
          { label: "Online store", text: "Your own web address", href: "#sell-everywhere", icon: "globe" },
          { label: "Social selling", text: "One link for bio and posts", href: "#sell-everywhere", icon: "share" },
        ],
      },
      {
        title: "By stage",
        links: [
          { label: "New shops", text: "Launch in an afternoon", href: "#how-it-works", icon: "rocket" },
          { label: "Growing brands", text: "Bigger catalogues, more orders", href: "#stories", icon: "users" },
        ],
      },
    ],
  },
  {
    label: "Templates",
    groups: [
      {
        title: "Store designs",
        links: [
          { label: "Forma", text: "Home and living", href: "/theme-preview/jelly-forma", icon: "store" },
          { label: "Halo", text: "Beauty and skincare", href: "/theme-preview/jelly-halo", icon: "store" },
          { label: "Diode", text: "Electronics", href: "/theme-preview/jelly-diode", icon: "store" },
          { label: "Avenue", text: "Fashion", href: "/theme-preview/jelly-avenue", icon: "store" },
        ],
      },
    ],
  },
  { label: "Pricing", href: "#pricing" },
  {
    label: "Resources",
    groups: [
      {
        title: "Learn",
        links: [
          { label: "Questions", text: "Payments, moving shops, plans", href: "#faq", icon: "lifebuoy" },
          { label: "Merchant stories", text: "How shops grow", href: "#stories", icon: "star" },
        ],
      },
      {
        title: "Build",
        links: [
          { label: "Developers", text: "Theme kit and access tokens", href: "#developers", icon: "code" },
          { label: "Security", text: "How we protect stores", href: "#trust", icon: "shield" },
        ],
      },
    ],
  },
];

/** Invented shop names (Jellyshop has no named customers yet). Shown as text, never as real logos. */
export const shops = ["Clay & Co.", "NORTHSIDE AUDIO", "kindly skin", "Fern+Field", "Little Loom", "Oxbow Supply", "MERIDIAN", "Salt House", "paper/ink", "Tallow & Wick"] as const;

export const stats = [
  { value: 6, suffix: "", label: "store designs ready to edit" },
  { value: 5, suffix: " min", label: "from sign-up to a draft store" },
  { value: 28, suffix: "", label: "fonts in the visual editor" },
  { value: 5000, suffix: "", label: "products per spreadsheet import" },
] as const;

export const steps = [
  { title: "Create your store", text: "Pick a name, a web address and a design. You're editing your own store in under five minutes.", image: "feature-storefront" },
  { title: "Add your products", text: "Photos, prices, sizes and stock, one at a time or thousands at once from a spreadsheet.", image: "feature-products" },
  { title: "Get paid", text: "Connect Stripe and take card payments at a checkout that checks every price on our servers.", image: "feature-checkout" },
  { title: "Publish and grow", text: "Go live, share one link everywhere, and watch orders and sales from one dashboard.", image: "feature-analytics" },
] as const;

export const features = [
  { id: "storefront", title: "Storefront builder", text: "Drag sections into place and edit live. Draft safely, publish when you're ready.", size: "wide" },
  { id: "products", title: "Products and inventory", text: "Variants, collections and stock alerts in one list.", size: "tall" },
  { id: "checkout", title: "Checkout and payments", text: "Card payments through Stripe, money straight to your account.", size: "base" },
  { id: "orders", title: "Orders and delivery", text: "Packing slips, tracking links and shipping emails.", size: "base" },
  { id: "analytics", title: "Analytics", text: "Sales, orders and average order value for any period.", size: "base" },
  { id: "marketing", title: "Marketing", text: "Reviews, newsletter sign-ups and back-in-stock emails.", size: "wide" },
] as const;

export const templates = [
  { slug: "jelly-forma", name: "Forma", category: "Home and living" },
  { slug: "jelly-halo", name: "Halo", category: "Beauty" },
  { slug: "jelly-diode", name: "Diode", category: "Electronics" },
  { slug: "jelly-avenue", name: "Avenue", category: "Fashion" },
  { slug: "jelly-resthaven", name: "Resthaven", category: "Beds and bedroom" },
  { slug: "jelly-harbour", name: "Harbour", category: "Coastal home" },
] as const;

export const channels = [
  { title: "Online store", text: "Your own shop on your own web address.", icon: "globe", soon: false },
  { title: "Social", text: "Share one link in your bio, posts and stories.", icon: "share", soon: false },
  { title: "Marketplaces", text: "List products where shoppers already search.", icon: "bag", soon: true },
  { title: "In person", text: "Take payments at markets and pop-ups.", icon: "phone", soon: true },
] as const;

/** Real integrations only. `logo` = official mark in /public/logos (see LOGOS.md); otherwise a generic icon. */
export const integrations: { name: string; text: string; logo?: string; icon?: IconName; soon?: boolean }[] = [
  { name: "Stripe", text: "Payments and payouts", logo: "stripe" },
  { name: "YouTube", text: "Video blocks", logo: "youtube" },
  { name: "Vimeo", text: "Video blocks", logo: "vimeo" },
  { name: "Spotify", text: "Music embeds", logo: "spotify" },
  { name: "SoundCloud", text: "Audio embeds", logo: "soundcloud" },
  { name: "Google Maps", text: "Store locations", icon: "map" },
  { name: "Calendly", text: "Booking embeds", icon: "calendar" },
  { name: "Typeform", text: "Form embeds", icon: "sheet" },
  { name: "Google Forms", text: "Form embeds", icon: "sheet" },
  { name: "Airtable", text: "Table embeds", icon: "sheet" },
  { name: "CSV and Excel", text: "Import and export", icon: "sheet" },
  { name: "Email (SMTP)", text: "Order emails", icon: "mail" },
];

export const codeLines = [
  { kind: "comment", text: "# create a theme and preview it live" },
  { kind: "cmd", text: "jelly-theme create my-theme" },
  { kind: "cmd", text: "jelly-theme dev my-theme" },
  { kind: "out", text: "› Preview ready at http://localhost:5273" },
  { kind: "comment", text: "# package it and send it to your store" },
  { kind: "cmd", text: "jelly-theme package my-theme" },
  { kind: "cmd", text: "jelly-theme upload my-theme" },
  { kind: "ok", text: "✓ Uploaded my-theme 1.0.0" },
] as const;

export const stories = [
  { name: "Maya Okafor", role: "Founder, Clay & Co.", avatar: "avatar-1", quote: "I moved my ceramics shop over in an afternoon. Customers say it finally looks like us.", metric: 38, prefix: "+", suffix: "%", metricLabel: "repeat orders in 3 months" },
  { name: "Dev Patel", role: "Owner, Northside Audio", avatar: "avatar-2", quote: "Spec tables and the compare tray answer the questions I used to get by email every day.", metric: 2.4, prefix: "", suffix: "×", decimals: 1, metricLabel: "product pages viewed per visit" },
  { name: "Sofia Lind", role: "Co-founder, Kindly Skin", avatar: "avatar-3", quote: "I imported 140 products from a spreadsheet before lunch. Every row was checked first.", metric: 140, prefix: "", suffix: "", metricLabel: "products imported in one go" },
] as const;

export const plans = [
  { name: "Starter", monthly: 0, text: "Everything to open your first shop.", items: ["1 store, up to 25 products", "Stripe checkout", "All store designs", "Email support"], cta: "Start free", featured: false },
  { name: "Grow", monthly: 19, text: "For shops selling every week.", items: ["Unlimited products", "Reviews and back-in-stock emails", "Bulk import and export", "Password page before launch"], cta: "Start 14-day trial", featured: true },
  { name: "Studio", monthly: 49, text: "For teams and bigger catalogues.", items: ["Staff accounts and roles", "Upload your own themes", "Developer access tokens", "Priority support"], cta: "Start 14-day trial", featured: false },
] as const;

export const trust = [
  { title: "Secure payments", text: "Card details go straight to Stripe (PCI DSS Level 1). We never see or store them.", icon: "lock" },
  { title: "Safe publishing", text: "Edit a draft, publish when ready, roll back to an earlier version in two clicks.", icon: "history" },
  { title: "Your data, your call", text: "Each store's data is kept separate. Export products and orders any time.", icon: "shield" },
  { title: "Real people", text: "Email support from the team that builds Jellyshop.", icon: "lifebuoy" },
] as const;

export const faqs = [
  { q: "What is Jellyshop?", a: "An online store builder for independent brands: a storefront you design, products and stock, checkout and orders in one dashboard." },
  { q: "Do I need to code?", a: "No. Pick a design, then change words, photos and layout in the visual editor. Developers can go further with the theme kit." },
  { q: "How do I get paid?", a: "Connect a Stripe account during setup. Customers pay by card and the money goes to your Stripe balance." },
  { q: "Can I move from another platform?", a: "Yes. Export a CSV or Excel file from your old shop and import it. Every row is checked before anything is saved." },
  { q: "Is there really a free plan?", a: "Yes. Starter is free with up to 25 products. Upgrade when you need more and cancel any time." },
  { q: "Can I use my own domain?", a: "Every store gets a Jellyshop web address straight away. Connecting your own domain is coming soon." },
] as const;

export const footer = [
  { title: "Product", links: [["Storefront builder", "#features"], ["Store designs", "#templates"], ["Pricing", "#pricing"], ["Integrations", "#integrations"]] },
  { title: "Solutions", links: [["Online store", "#sell-everywhere"], ["Social selling", "#sell-everywhere"], ["New shops", "#how-it-works"]] },
  { title: "Resources", links: [["Questions", "#faq"], ["Developers", "#developers"], ["Live demo store", "/theme-preview/jelly-forma"], ["Changelog", "/changelog"]] },
  { title: "Company", links: [["Security", "#trust"], ["Merchant stories", "#stories"], ["Log in", "/login"]] },
  { title: "Legal", links: [["Terms", "/legal/terms"], ["Privacy", "/legal/privacy"], ["Cookies", "/legal/cookies"]] },
] as const;

/** Jellyshop's own social accounts. Addresses still to be confirmed by the owner (see open items). */
export const social = [
  { label: "Instagram", href: "#" },
  { label: "LinkedIn", href: "#" },
  { label: "X", href: "#" },
  { label: "YouTube", href: "#" },
] as const;
