import type { PolicyKind } from "@jelly/storefront-schema";

/**
 * Starter wording for the four store policies. They are a starting point only: the admin says so next to the button,
 * and the page is created as a draft so the owner reads and edits it before shoppers can see it.
 */
export interface PolicyDetails { storeName: string; legalName: string; email: string; address: string }
type Block = { type: "heading"; attrs: { level: 2 }; content: { type: "text"; text: string }[] } | { type: "paragraph"; content: { type: "text"; text: string }[] } | { type: "bulletList"; content: { type: "listItem"; content: { type: "paragraph"; content: { type: "text"; text: string }[] }[] }[] };

const text = (value: string) => [{ type: "text" as const, text: value }];
const h = (value: string): Block => ({ type: "heading", attrs: { level: 2 }, content: text(value) });
const p = (value: string): Block => ({ type: "paragraph", content: text(value) });
const list = (items: string[]): Block => ({ type: "bulletList", content: items.map((item) => ({ type: "listItem" as const, content: [{ type: "paragraph" as const, content: text(item) }] })) });

export const POLICY_TITLES: Record<PolicyKind, string> = { refund: "Refund policy", privacy: "Privacy policy", terms: "Terms of service", shipping: "Shipping policy" };
export const POLICY_HANDLES: Record<PolicyKind, string> = { refund: "returns", privacy: "privacy", terms: "terms", shipping: "shipping" };

export function policyTemplate(kind: PolicyKind, details: PolicyDetails): { type: "doc"; content: Block[] } {
  const who = details.legalName || details.storeName || "we";
  const business = details.legalName || details.storeName || "our business";
  const contact = details.email ? `email us at ${details.email}` : "contact us using the details on our contact page";
  const where = details.address ? ` Our address is ${details.address}.` : "";
  const blocks: Record<PolicyKind, Block[]> = {
    refund: [
      p(`We want you to love what you buy from ${details.storeName || "us"}. If something isn't right, here is how returns and refunds work.`),
      h("Returns"),
      p("You can return most items within 30 days of delivery for a refund. Items must be unused, in their original condition and packaging, with proof of purchase."),
      p("Some items can't be returned, such as personalised or made-to-order goods, perishable goods and items that are unsealed for hygiene reasons, unless they are faulty."),
      h("How to return an item"),
      list([`Before sending anything back, ${contact} with your order number.`, "We will tell you where to send the item.", "Pack it carefully. We recommend a tracked service, as we can't refund items lost on the way back to us."]),
      h("Refunds"),
      p("Once we receive and check your return we will email you. Approved refunds go back to your original payment method within 14 days. Your bank may take a few more days to show it."),
      h("Faulty or wrong items"),
      p(`If your item arrives damaged, faulty or isn't what you ordered, ${contact} within 14 days and we will put it right. This doesn't affect your statutory rights.`),
    ],
    privacy: [
      p(`This policy explains how ${business} collects, uses and protects your personal information when you visit or buy from our store.${where}`),
      h("What we collect"),
      list(["Details you give us: your name, email address, phone number, delivery and billing addresses.", "Order details: what you bought, when and how much you paid. Card details are handled by our payment provider; we never see or store your full card number.", "Information collected automatically: your device, browser, pages viewed and how you reached our store, through cookies and similar tools."]),
      h("How we use it"),
      list(["To process and deliver your orders and keep you updated about them.", "To answer your questions and provide customer support.", "To send you marketing emails, only if you have agreed. You can unsubscribe at any time.", "To keep our store secure and prevent fraud.", "To understand how our store is used and improve it."]),
      h("Who we share it with"),
      p("We share information only with services that help us run the store, such as our store platform, payment provider, delivery companies and, if you agree to cookies, analytics and advertising tools. We never sell your personal information."),
      h("Cookies"),
      p("We use cookies that the store needs to work, such as remembering your bag. Analytics and advertising cookies are used only if you agree to them in our cookie banner."),
      h("Your rights"),
      p(`Depending on where you live, you may have the right to see, correct or delete your personal information, or to object to how we use it. To ask, ${contact}. You can also complain to your local data protection authority.`),
      h("How long we keep it"),
      p("We keep order records for as long as the law requires (often six years for tax purposes) and other information only as long as we need it."),
    ],
    terms: [
      p(`These terms apply when you use the ${details.storeName || "our"} store and buy from ${who}.${where} By placing an order you agree to them.`),
      h("Orders"),
      p("When you place an order we will email you to confirm we have received it. A contract is formed when we confirm your order is on its way. We may refuse an order, for example if an item is out of stock or the price was shown incorrectly, and will refund anything you have paid."),
      h("Prices and payment"),
      p("Prices are shown in the store's currency and include any taxes we are required to charge, unless stated otherwise. Delivery charges are shown before you pay."),
      h("Delivery"),
      p("Delivery times are estimates. See our shipping policy for details. The risk in the goods passes to you on delivery."),
      h("Returns"),
      p("See our refund policy for how to return items. Nothing in these terms affects your statutory rights."),
      h("Our liability"),
      p("We are responsible for loss or damage you suffer that is a foreseeable result of us breaking these terms. We are not responsible for loss that was not foreseeable, or for business losses."),
      h("Contact"),
      p(`If you have any questions about these terms, ${contact}.`),
    ],
    shipping: [
      p("Here is how and when we deliver your order."),
      h("Processing time"),
      p("Orders are usually packed and sent within 1 to 3 working days. You will receive an email with tracking details when your order is on its way."),
      h("Delivery times and costs"),
      p("Delivery options, times and costs are shown at checkout before you pay. Delivery times are estimates and may be longer during busy periods."),
      h("Where we deliver"),
      p("We deliver to the countries offered at checkout. Orders sent abroad may be charged import duties and taxes by the destination country, which are paid by the recipient."),
      h("Problems with your delivery"),
      p(`If your order is late, damaged or missing, ${contact} with your order number and we will help.`),
    ],
  };
  return { type: "doc", content: blocks[kind] };
}
