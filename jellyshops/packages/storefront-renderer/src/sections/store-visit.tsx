import { StorefrontContainer } from "@jelly/storefront-ui";
import { safeRichTextHref, type SectionNode } from "@jelly/storefront-schema";
import { headingHidden, imageValue, sectionData, stringValue, visibleBlocks } from "./shared";

/** Digits only, keeping a leading "+" for tel: links. */
function dialable(value: string, keepPlus: boolean): string {
  const digits = value.replace(/[^\d]/g, "");
  return keepPlus && value.trim().startsWith("+") ? `+${digits}` : digits;
}

/** The merchant's map link when it is a safe web address, otherwise a Google Maps search for the address. */
export function mapHref(mapLink: string, address: string): string | undefined {
  const own = mapLink.trim() ? safeRichTextHref(mapLink.trim()) : null;
  if (own && /^https?:\/\//i.test(own)) return own;
  const query = address.replace(/\s+/g, " ").trim();
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : undefined;
}

/** "Mon–Fri: 10am–7pm" lines become name/value pairs; lines without a colon are shown as written. */
function openingHours(text: string): Array<{ day: string; time?: string }> {
  return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const separator = line.indexOf(":");
    return separator > 0 && separator < line.length - 1
      ? { day: line.slice(0, separator).trim(), time: line.slice(separator + 1).trim() }
      : { day: line };
  });
}

/**
 * Visit-us section for a showroom or shop: address with directions, opening
 * hours, and buttons to call, message on WhatsApp or email. Every part is
 * optional and hidden when empty.
 */
export function StoreVisitSection({ section }: { section: SectionNode }) {
  const settings = section.settings;
  const heading = stringValue(settings, "heading", "Visit us");
  const text = stringValue(settings, "text");
  const address = stringValue(settings, "address");
  const hours = openingHours(stringValue(settings, "hours"));
  const phone = stringValue(settings, "phone");
  const whatsapp = dialable(stringValue(settings, "whatsapp"), false);
  const email = stringValue(settings, "email").trim();
  const directions = mapHref(stringValue(settings, "mapLink"), address);
  const image = imageValue(settings);
  const details = visibleBlocks(section, "contact-item").flatMap((block) => {
    const value = stringValue(block.settings, "value");
    return value ? [{ id: block.id, label: stringValue(block.settings, "label"), value }] : [];
  });
  const actions = [
    directions && address ? { key: "directions", href: directions, label: "Get directions", external: true } : undefined,
    dialable(phone, true) ? { key: "call", href: `tel:${dialable(phone, true)}`, label: `Call ${phone.trim()}` } : undefined,
    whatsapp ? { key: "whatsapp", href: `https://wa.me/${whatsapp}`, label: "Message on WhatsApp", external: true } : undefined,
    email && /^[^\s@]+@[^\s@]+$/.test(email) ? { key: "email", href: `mailto:${email}`, label: `Email ${email}` } : undefined,
  ].filter((action): action is NonNullable<typeof action> => Boolean(action));

  if (!address && !hours.length && !actions.length && !details.length && !text) return null;
  return <section className="jelly-section jelly-store-visit" {...sectionData(section, { "data-has-image": image ? "true" : undefined })}><StorefrontContainer>
    <div className="jelly-store-visit-body">
      {!headingHidden(section) && <h2>{heading}</h2>}
      {text && <p className="jelly-store-visit-text">{text}</p>}
      {address && <address className="jelly-store-visit-address">{address.split("\n").map((line, index) => <span key={index}>{line}</span>)}</address>}
      {hours.length > 0 && <div className="jelly-store-visit-hours">
        <h3>Opening hours</h3>
        <dl>{hours.map((row, index) => <div key={index}><dt>{row.day}</dt>{row.time && <dd>{row.time}</dd>}</div>)}</dl>
      </div>}
      {details.length > 0 && <ul className="jelly-store-visit-details">{details.map((item) => <li key={item.id}>{item.label && <span>{item.label}</span>}{item.value}</li>)}</ul>}
      {actions.length > 0 && <div className="jelly-store-visit-actions">
        {actions.map((action, index) => <a key={action.key} href={action.href} className={index === 0 ? "jelly-button" : "jelly-button jelly-button--secondary"} {...(action.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{action.label}</a>)}
      </div>}
    </div>
    {image && <div className="jelly-store-visit-media">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.url} alt={image.alt ?? ""} loading="lazy" />
    </div>}
  </StorefrontContainer></section>;
}
