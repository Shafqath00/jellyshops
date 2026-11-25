/**
 * Text of the legal pages: Terms of Service, Privacy Policy and Cookie Policy.
 *
 * The backend reads the same version string (JELLYSHOP_TERMS_VERSION) to know which terms a merchant accepted.
 * When you change the wording in a way that matters, change LEGAL_VERSION here and set the same value on the backend.
 */
export const LEGAL_VERSION = "2026-11-25";
export const LEGAL_UPDATED = "2026-11-25";

/** Where people reach us about legal matters. Confirm this mailbox exists before launch. */
export const LEGAL_CONTACT_EMAIL = "legal@jellyshop.io";
export const SUPPORT_EMAIL = "support@jellyshop.io";

export type LegalBlock =
  | { p: string }
  | { ul: readonly string[] }
  | { table: { head: readonly string[]; rows: readonly (readonly string[])[] } };

export type LegalSection = { id: string; title: string; blocks: readonly LegalBlock[] };

export type LegalDocument = {
  slug: "terms" | "privacy" | "cookies";
  label: string;
  title: string;
  summary: string;
  sections: readonly LegalSection[];
};

const terms: LegalDocument = {
  slug: "terms",
  label: "Terms",
  title: "Terms of Service",
  summary: "The agreement between you and Jelly Labs when you use Jellyshop to build and run an online store.",
  sections: [
    {
      id: "who-we-are",
      title: "1. Who we are and what these terms cover",
      blocks: [
        { p: "Jellyshop is an online store builder run by Jelly Labs (\"Jellyshop\", \"we\", \"us\"). These terms are the agreement between you and us when you create an account, build a store, or use any part of Jellyshop, including the dashboard, the theme editor, the storefront we host for you, our APIs and our developer tools (together, the \"Service\")." },
        { p: "If you use Jellyshop for a business or on behalf of an organisation, you confirm that you can bind that business to these terms. If you do not agree to these terms, do not use the Service." },
        { p: "These terms are for people who run a store (\"merchants\"). Shoppers who buy from a store are customers of that merchant, not of Jellyshop; see section 8." },
      ],
    },
    {
      id: "account",
      title: "2. Your account",
      blocks: [
        { p: "You must be at least 18 years old, or the age of majority where you live, to open an account. You must give accurate information and keep it up to date." },
        { p: "You are responsible for everything that happens under your account. Keep your password safe, turn on any extra sign-in protection we offer, and tell us straight away at the address in section 17 if you think someone else has got in." },
        { p: "You can invite other people to work on a store. You decide what each person can do, and you are responsible for what they do on your store." },
      ],
    },
    {
      id: "plans",
      title: "3. Plans, trials, billing and cancelling",
      blocks: [
        { p: "New stores start with a free trial of 14 days. No card is needed to start. During the trial, lower usage limits apply (for example fewer products and less photo storage). The limits for each plan are shown in your dashboard under Settings, Plan and billing." },
        { p: "To keep a store running after the trial, you subscribe to a paid plan for that store, billed monthly or yearly in pounds sterling. Current prices are on our website and at checkout. Prices shown do not include taxes unless we say so; if we are required to charge tax, we will show it before you pay." },
        { ul: [
          "Subscriptions renew automatically at the end of each period until you cancel. Payments are taken by our payment provider, Stripe. We never see or store your full card number.",
          "You can cancel at any time from Plan and billing. Your plan stays active until the end of the period you have paid for. We do not give refunds for part of a period, except where the law says we must.",
          "If a payment fails, we will email you and your payment provider may try again. You have a grace period of 7 days from the first failed payment to fix it. If it is still unpaid after that, we may pause your store: the storefront shows a \"temporarily unavailable\" page and checkout is switched off. You can still sign in to the dashboard, fix your payment and reopen the store.",
          "If a trial ends and no plan is bought, the store is paused in the same way.",
          "We can change our prices or plan limits. We will give you at least 30 days' notice by email before a change reaches your plan, and you can cancel before it starts.",
        ] },
      ],
    },
    {
      id: "your-store",
      title: "4. Your store and your content",
      blocks: [
        { p: "You keep ownership of everything you add to your store: product details, photos, text, logos, designs you create, and your customer and order data (\"Your Content\")." },
        { p: "You give us a licence to host, copy, resize, transmit and display Your Content as far as needed to run the Service for you, for example to show your store to shoppers, create smaller copies of your photos, back up your data and send emails you ask us to send. This licence ends when your content is deleted from the Service, apart from backups that are removed in the normal cycle." },
        { p: "You promise that you own Your Content or have permission to use it, and that it and the way you use it does not break the law or anyone else's rights." },
      ],
    },
    {
      id: "acceptable-use",
      title: "5. What you must not do",
      blocks: [
        { p: "You must not use Jellyshop to:" },
        { ul: [
          "sell or promote anything illegal, stolen, counterfeit or fake, or anything that infringes someone's copyright, trade mark or other rights;",
          "sell goods or services that are prohibited or restricted by Stripe's rules for businesses (see stripe.com/legal/restricted-businesses), including weapons, illegal drugs, adult sexual content, and anything that exploits or endangers children;",
          "run scams, phishing, fake shops, pyramid schemes or other fraud;",
          "send spam, or email people who have not agreed to hear from you;",
          "upload malware, or try to break, overload, probe or get around the security of the Service or of other stores;",
          "access another store's data, or scrape or copy the Service at a scale that harms it;",
          "resell or share the Service in a way that is not allowed by your plan;",
          "use the Service to harass, threaten or discriminate against anyone.",
        ] },
        { p: "If you break these rules, we may remove content, pause or close a store, or close your account. We will usually warn you first and give you a chance to put things right, but we may act at once where there is a risk to shoppers, to other merchants, to the Service, or where the law requires it." },
      ],
    },
    {
      id: "payments",
      title: "6. Taking payments from shoppers",
      blocks: [
        { p: "Payments from shoppers go through Stripe Connect. To take payments you must create or connect a Stripe account and accept Stripe's own terms, including the Stripe Connected Account Agreement. Stripe, not Jellyshop, holds your funds and pays them out. We are not a bank, a payment institution or a money transmitter." },
        { p: "Money from sales goes to your Stripe account, less Stripe's fees. We do not currently take a percentage of your sales; if that changes we will tell you in advance under section 3." },
        { p: "You are responsible for refunds, chargebacks and disputes on your orders, for the prices you set, for dispatching orders on time, and for working out, collecting and paying any tax you owe (such as VAT or sales tax)." },
      ],
    },
    {
      id: "your-shoppers",
      title: "7. Your obligations to your own customers",
      blocks: [
        { p: "You are the seller. Your shoppers have a contract with you. You must follow the consumer, e-commerce, advertising, product-safety and tax laws that apply to what you sell and where you sell it. In the UK that includes the Consumer Rights Act 2015 and the Consumer Contracts Regulations 2013, which give shoppers rights such as a right to cancel most online orders within 14 days." },
        { p: "You must show your own business name, address, contact details, delivery and returns terms, and a privacy notice on your store. Jellyshop provides starter pages as a convenience. They are not legal advice and you should check them against your own business." },
      ],
    },
    {
      id: "data",
      title: "8. Customer data and privacy",
      blocks: [
        { p: "For the personal data of your shoppers (names, addresses, emails, order details), you are the controller and Jellyshop acts as your processor, handling it only on your instructions to run the Service. For your own account details and how we run the Service, we are the controller. Our Privacy Policy explains this in full and forms part of these terms." },
        { p: "You must have a lawful basis for the data you collect through your store, tell your shoppers how you use it, and get consent for marketing emails where the law requires it." },
      ],
    },
    {
      id: "themes",
      title: "9. Themes, apps and developer tools",
      blocks: [
        { p: "Jellyshop provides built-in themes. Developers may build and upload their own themes using our developer tools. Themes you upload are private to your stores. You must own or have the right to use everything in a theme you upload, and a theme must not contain code or content that breaks section 5." },
        { p: "Developer tokens give access to your store's theme tools. Treat them like passwords. You are responsible for what is done with a token you create, and you can switch it off at any time." },
        { p: "If you embed third-party apps or services in your store (for example maps, booking or form tools), that third party's own terms apply. We are not responsible for them." },
      ],
    },
    {
      id: "ours",
      title: "10. Our intellectual property",
      blocks: [
        { p: "We own the Service, including the software, built-in themes, designs, the Jellyshop name and logo, and documentation. These terms give you a limited, non-exclusive, non-transferable right to use the Service while your account is in good standing. They do not give you ownership of any of it." },
        { p: "If you send us feedback or ideas, we may use them without owing you anything." },
      ],
    },
    {
      id: "availability",
      title: "11. Keeping the Service running",
      blocks: [
        { p: "We work hard to keep Jellyshop available and secure, but we cannot promise it will always be uninterrupted or error-free. We may carry out maintenance, and we may add, change or remove features. If we remove a feature that matters to you in a way that affects your store, we will give reasonable notice where we can." },
        { p: "You are responsible for keeping your own copies of anything you cannot afford to lose. You can export your products and orders from the dashboard at any time." },
      ],
    },
    {
      id: "ending",
      title: "12. Ending your use of Jellyshop",
      blocks: [
        { p: "You can close your store or account at any time. We may suspend or close your account if you break these terms, if you do not pay, if we are required to by law, or if we stop offering the Service (in which case we will give you at least 60 days' notice and a way to export your data)." },
        { p: "After a store is closed or paused for non-payment, we keep its data for 90 days so you can come back. After that we may delete it permanently. Some records (for example invoices and order records we must keep for tax or legal reasons) are kept for as long as the law requires. Sections that by their nature should survive, including 4, 10, 13, 14 and 15, continue after these terms end." },
      ],
    },
    {
      id: "warranty",
      title: "13. No other promises",
      blocks: [
        { p: "Except where the law says otherwise, the Service is provided \"as it is\" and \"as available\". We do not promise that it will meet your particular needs, increase your sales, or be free from every error. Nothing in these terms limits any right you have as a consumer that cannot be limited by law." },
      ],
    },
    {
      id: "liability",
      title: "14. Limits on our liability",
      blocks: [
        { p: "Nothing in these terms limits or excludes our liability for death or personal injury caused by our negligence, for fraud or fraudulent misrepresentation, or for anything else that cannot be limited or excluded by law." },
        { p: "Subject to that, we are not liable for: loss of profit, revenue, sales, goodwill or data; loss that was not a reasonably foreseeable result of our breach; or any indirect or consequential loss. We are also not liable for problems caused by things outside our reasonable control, such as outages at payment, hosting, internet or email providers." },
        { p: "Subject to the first paragraph of this section, our total liability to you for all claims arising out of or in connection with the Service in any 12-month period is limited to the amount you paid us for the Service in the 12 months before the event that gave rise to the claim." },
        { p: "You agree to cover us against claims by third parties arising from Your Content, the goods or services you sell, or your breach of these terms or of the law, to the extent the law allows." },
      ],
    },
    {
      id: "changes",
      title: "15. Changes to these terms",
      blocks: [
        { p: "We may update these terms, for example when we add features or when the law changes. For a change that matters, we will tell you by email or in the dashboard at least 30 days before it takes effect and ask you to accept the new version. If you do not agree, you can cancel before the change starts. If you carry on using the Service after it starts, you accept the new terms. The version number and date at the top of the page show which version applies." },
      ],
    },
    {
      id: "law",
      title: "16. Governing law and disputes",
      blocks: [
        { p: "These terms and any dispute about them are governed by the law of England and Wales, and the courts of England and Wales have jurisdiction, except that if you are a consumer living elsewhere in the UK or in another country you keep any right to use the courts or the mandatory consumer law where you live. Please contact us first at the address below; most problems can be settled without going to court." },
        { p: "If a part of these terms is found to be unenforceable, the rest still applies. If we do not enforce a right straight away, that does not mean we have given it up. You may not transfer your rights under these terms without our written consent; we may transfer ours as part of a sale of the business. These terms, with the Privacy Policy and Cookie Policy, are the whole agreement between you and us about the Service." },
      ],
    },
    {
      id: "contact",
      title: "17. Contact us",
      blocks: [
        { p: `Questions about these terms, or to report a problem with someone's account or a store: ${LEGAL_CONTACT_EMAIL}. For help with using Jellyshop: ${SUPPORT_EMAIL}.` },
      ],
    },
  ],
};

const privacy: LegalDocument = {
  slug: "privacy",
  label: "Privacy",
  title: "Privacy Policy",
  summary: "What personal data Jellyshop collects, why, who sees it, how long we keep it and the rights you have.",
  sections: [
    {
      id: "who",
      title: "1. Who this policy is for",
      blocks: [
        { p: "This policy explains how Jelly Labs (\"Jellyshop\", \"we\", \"us\") handles personal data. It covers two groups of people:" },
        { ul: [
          "Merchants and visitors to jellyshop.io: people who visit our website, create an account or run a store with us. For this data we are the controller.",
          "Shoppers on a merchant's store: people who browse or buy on a store built with Jellyshop. For this data the merchant is the controller and we are their processor. If you are a shopper and have a question about your data, please ask the store first; their own privacy notice applies. We will help them answer you.",
        ] },
        { p: "We follow the UK GDPR and the Data Protection Act 2018, and treat people elsewhere with the same care." },
      ],
    },
    {
      id: "collect",
      title: "2. What we collect",
      blocks: [
        { table: {
          head: ["Who", "Data", "Where it comes from"],
          rows: [
            ["Merchants", "Name, email address, password (stored only as a protected hash by our sign-in provider), business details, store name and address, team members you invite", "You, when you sign up and set up your store"],
            ["Merchants", "Subscription and billing status, plan, invoices (card details are held by Stripe, never by us)", "You and Stripe"],
            ["Merchants", "Products, photos, pages, designs, settings and files you add", "You"],
            ["Merchants", "Sign-in times, the last time a store was used, security and error logs, IP address, browser type", "Collected automatically when you use the Service"],
            ["Shoppers", "Name, email, phone, delivery and billing address, order contents, messages sent through a store, newsletter sign-up and consent", "The shopper, at checkout, in forms or in an account"],
            ["Shoppers", "Payment details, entered directly with Stripe. We receive the payment status and the last four card digits, not the full card", "Stripe"],
            ["Shoppers", "Pages viewed, bag contents, recently viewed and compare lists (kept in the browser), a once-a-day visit count for the store, IP address", "Collected automatically"],
            ["Visitors", "Messages you send to us, and basic technical data when you visit our site", "You and your browser"],
          ],
        } },
        { p: "We do not knowingly collect data from children under 13, and our Service is not meant for them. We do not sell personal data." },
      ],
    },
    {
      id: "why",
      title: "3. Why we use it and our legal basis",
      blocks: [
        { table: {
          head: ["What we do", "Legal basis"],
          rows: [
            ["Create and run your account and store, host your storefront, process orders for you", "Contract: needed to provide the Service you asked for"],
            ["Take your subscription payments and keep billing records", "Contract, and legal obligation (tax and accounting)"],
            ["Send service emails: sign-in links, receipts, trial and payment reminders, security notices, order emails on a merchant's behalf", "Contract and our legitimate interest in running the Service safely"],
            ["Keep the Service secure, stop fraud and abuse, enforce our terms, limit how often forms can be used", "Legitimate interest in protecting the Service, our merchants and their shoppers"],
            ["Fix problems, measure speed and improve Jellyshop", "Legitimate interest in improving the Service"],
            ["Send product news or offers to merchants who ask for them", "Consent. You can withdraw it at any time, and every email has an unsubscribe link"],
            ["Meet legal duties and answer legal requests", "Legal obligation"],
          ],
        } },
        { p: "Where we process shopper data as a processor, we only do so on the merchant's instructions." },
      ],
    },
    {
      id: "share",
      title: "4. Who we share data with",
      blocks: [
        { p: "We share personal data only with companies that help us run Jellyshop, under contracts that require them to protect it and use it only for us:" },
        { ul: [
          "Stripe: card payments, payouts and subscription billing. Stripe is also an independent controller for the data it needs to meet its own legal duties, under its own privacy policy.",
          "Supabase: sign-in and our database.",
          "Google Cloud and Firebase: running our server software.",
          "Vercel: hosting our website and storefronts.",
          "Cloudflare: storing and delivering photos and files.",
          "Our email delivery provider: sending sign-in, order and service emails.",
        ] },
        { p: "We also share data where the law or a court requires it, to protect people from harm or fraud, or in a sale or reorganisation of the business (the buyer must honour this policy). Merchants can see their own shoppers' data. We do not share one merchant's data with another." },
      ],
    },
    {
      id: "transfers",
      title: "5. Sending data abroad",
      blocks: [
        { p: "Some of the companies above are based outside the UK, and our servers may be outside the UK (for example in the United States). When data leaves the UK we use the safeguards the law allows, such as the UK's international data transfer agreements or approved data bridges, so it keeps equivalent protection." },
      ],
    },
    {
      id: "keep",
      title: "6. How long we keep data",
      blocks: [
        { ul: [
          "Account and store data: while your account is open. After a store is closed or paused for non-payment, we keep it for 90 days so you can come back, then delete it.",
          "Billing and tax records: for as long as the law requires (usually 6 years in the UK).",
          "Orders: kept for the merchant for as long as they keep the store, and for the period they need for accounting and refunds.",
          "Security and error logs: a short period, usually up to 90 days, unless needed to investigate a problem.",
          "Backups: removed in the normal backup cycle after deletion.",
        ] },
        { p: "We may keep data for longer if needed for a legal claim or to meet a legal duty." },
      ],
    },
    {
      id: "rights",
      title: "7. Your rights",
      blocks: [
        { p: "You have the right to ask us for a copy of your data, to correct it, to delete it, to restrict or object to how we use it, to move it to another service, and to withdraw consent at any time. You can also object to marketing at any time. To use these rights, email us at the address below. We will answer within one month." },
        { p: "If you are a shopper, please contact the store that holds your order data; if you contact us, we will pass your request on to them. If you are unhappy with how we handle your data you can complain to the Information Commissioner's Office (ico.org.uk, 0303 123 1113). We would appreciate the chance to put things right first." },
      ],
    },
    {
      id: "security",
      title: "8. How we protect data",
      blocks: [
        { p: "We use encryption in transit, separate each store's data from every other store, restrict who on our team can see it, keep staff access logged, and keep passwords only as protected hashes. Our platform admin area needs a second sign-in step. No system is perfectly secure. If a breach puts your data at risk, we will tell you and the regulator as the law requires." },
      ],
    },
    {
      id: "cookies",
      title: "9. Cookies and similar technologies",
      blocks: [
        { p: "We use a small number of cookies and browser storage items to keep you signed in, remember your choices and take payments. See our Cookie Policy for the full list." },
      ],
    },
    {
      id: "changes",
      title: "10. Changes to this policy",
      blocks: [
        { p: "We will update this policy when what we do changes. The date at the top shows the latest version. For changes that matter, we will tell merchants by email or in the dashboard before they take effect." },
      ],
    },
    {
      id: "contact",
      title: "11. Contact us",
      blocks: [
        { p: `Jelly Labs, privacy questions and requests: ${LEGAL_CONTACT_EMAIL}.` },
      ],
    },
  ],
};

const cookies: LegalDocument = {
  slug: "cookies",
  label: "Cookies",
  title: "Cookie Policy",
  summary: "The cookies and browser storage Jellyshop uses, what each one is for and how to control them.",
  sections: [
    {
      id: "what",
      title: "1. What cookies are",
      blocks: [
        { p: "Cookies are small text files that a website saves on your device. Websites also use similar tools such as your browser's local storage and session storage. In this policy, \"cookies\" means all of these." },
        { p: "Cookies that are strictly needed to give you something you asked for (such as staying signed in, or keeping items in your bag) do not need your consent. For anything else we ask first." },
      ],
    },
    {
      id: "now",
      title: "2. What we use today",
      blocks: [
        { p: "Jellyshop does not use advertising cookies, and we do not use cookies to track you across other websites. On jellyshop.io we do not currently set analytics cookies. If that changes, we will update this page and ask for your consent first." },
        { p: "Strictly necessary:" },
        { table: {
          head: ["Name", "What it does", "Kept for"],
          rows: [
            ["Sign-in session (Supabase, names begin sb-)", "Keeps a merchant signed in to the dashboard", "Until you sign out or the session ends"],
            ["jelly-customer-auth…", "Keeps a shopper signed in to their account on a store, if the store has accounts", "Until you sign out or the session ends"],
            ["__Host-jelly-access-…", "Remembers that you entered the password for a password-protected store", "30 days"],
            ["jelly-shop-state-v1", "Keeps your bag (cart) in your browser on a store", "Until you clear it or empty the bag"],
            ["Stripe (stripe.com, set while paying)", "Takes card payments safely and helps detect fraud", "Set by Stripe; see its cookie policy"],
          ],
        } },
        { p: "Preferences and convenience (kept in your browser's storage, not sent to us):" },
        { table: {
          head: ["Name", "What it does", "Kept for"],
          rows: [
            ["Light or dark mode choice", "Remembers which look you picked for our website", "Until you clear it"],
            ["jelly-checkout-details:<store>", "Fills in your details on the checkout page if you tick \"remember me\"", "Until you clear it or untick it"],
            ["jelly-recent:<store>, jelly-compare:<store>", "Recently viewed products and your compare list on a store", "Until you clear it"],
            ["Store language choice", "Remembers the language you chose on a store", "Until you clear it"],
            ["jelly-popup:<store>:…", "Remembers that you closed a pop-up so it is not shown again straight away", "Up to a year, as the store sets it"],
            ["Recently used colours (merchants)", "Remembers colours you used in the theme editor", "Until you clear it"],
            ["Unsaved editor changes (merchants)", "Lets you restore your last editing session if the page closes before saving", "Until saved or discarded"],
          ],
        } },
        { p: "We also count one visit a day for each store, without a cookie that identifies you, so merchants can tell when a store is still in use." },
      ],
    },
    {
      id: "stores",
      title: "3. Cookies on a merchant's store",
      blocks: [
        { p: "Each store on Jellyshop belongs to the merchant who runs it. A merchant can add things to their store, such as an embedded map, video or booking form from another company, that set their own cookies. Those are controlled by the merchant and the third party, not by us. The merchant's own cookie and privacy notice explains what they use." },
      ],
    },
    {
      id: "control",
      title: "4. How to control cookies",
      blocks: [
        { p: "You can delete or block cookies and clear stored site data in your browser settings (see your browser's help pages). If you block the strictly necessary ones, parts of Jellyshop will stop working: you will not be able to stay signed in, and your bag will empty when you leave the page." },
        { p: "To be asked again about any optional cookies we add in future, clear the site data for jellyshop.io." },
      ],
    },
    {
      id: "changes",
      title: "5. Changes and contact",
      blocks: [
        { p: `We will update this page if we start using new cookies. The date at the top shows the latest version. Questions: ${LEGAL_CONTACT_EMAIL}. See also our Privacy Policy for how we handle personal data.` },
      ],
    },
  ],
};

export const legalDocuments = { terms, privacy, cookies } as const;

export function formatLegalDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
