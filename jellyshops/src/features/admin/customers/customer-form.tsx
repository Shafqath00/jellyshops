"use client";
import type { CustomerAddress, CustomerInput } from "@/features/admin/api/admin-api";
import { Card, Field, HelpTip, TagInput } from "@/components/admin";

export type CustomerDraft = {
  firstName: string; lastName: string; email: string; phone: string; note: string; tags: string[];
  address: Required<CustomerAddress>; acceptsEmailMarketing: boolean;
};

export const emptyCustomer: CustomerDraft = {
  firstName: "", lastName: "", email: "", phone: "", note: "", tags: [],
  address: { line1: "", line2: "", city: "", region: "", postalCode: "", country: "" }, acceptsEmailMarketing: false,
};

export function customerToDraft(customer: Omit<CustomerInput, "email"> & { email?: string | null }): CustomerDraft {
  return {
    firstName: customer.firstName ?? "", lastName: customer.lastName ?? "", email: customer.email ?? "", phone: customer.phone ?? "",
    note: customer.note ?? "", tags: customer.tags ?? [], acceptsEmailMarketing: Boolean(customer.acceptsEmailMarketing),
    address: { ...emptyCustomer.address, ...(customer.address ?? {}) },
  };
}

/** What the API takes. Blank address lines are left out; a fully blank address clears it. */
export function draftToInput(draft: CustomerDraft): CustomerInput {
  const address = Object.fromEntries(Object.entries(draft.address).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value));
  return {
    firstName: draft.firstName.trim(), lastName: draft.lastName.trim(), phone: draft.phone.trim(), note: draft.note.trim(), tags: draft.tags,
    address: Object.keys(address).length ? { ...address, ...(address.country ? { country: address.country.toUpperCase() } : {}) } : null,
    acceptsEmailMarketing: draft.acceptsEmailMarketing,
  };
}

const ADDRESS_FIELDS: Array<{ key: keyof CustomerAddress; label: string; wide?: boolean; max: number }> = [
  { key: "line1", label: "Address", wide: true, max: 200 }, { key: "line2", label: "Flat, suite, etc. (optional)", wide: true, max: 200 },
  { key: "city", label: "Town or city", max: 120 }, { key: "region", label: "County or state (optional)", max: 120 },
  { key: "postalCode", label: "Postcode", max: 20 }, { key: "country", label: "Country code", max: 2 },
];

export function CustomerFormFields({ draft, onChange, emailLocked = false, knownTags = [] }: { draft: CustomerDraft; onChange: (draft: CustomerDraft) => void; emailLocked?: boolean; knownTags?: string[] }) {
  const set = <K extends keyof CustomerDraft>(key: K, value: CustomerDraft[K]) => onChange({ ...draft, [key]: value });
  return <>
    <Card title="Customer details">
      <div className="jk-grid-2">
        <Field id="customer-first" label="First name"><input id="customer-first" maxLength={120} autoComplete="off" value={draft.firstName} onChange={(event) => set("firstName", event.target.value)} /></Field>
        <Field id="customer-last" label="Last name"><input id="customer-last" maxLength={120} autoComplete="off" value={draft.lastName} onChange={(event) => set("lastName", event.target.value)} /></Field>
        <Field id="customer-email" label="Email" help={emailLocked ? "The email links this customer to their orders, so it cannot be changed here." : "Order emails and receipts go here."}>
          <input id="customer-email" type="email" required maxLength={254} readOnly={emailLocked} value={draft.email} onChange={(event) => set("email", event.target.value)} />
        </Field>
        <Field id="customer-phone" label="Phone (optional)"><input id="customer-phone" type="tel" maxLength={40} value={draft.phone} onChange={(event) => set("phone", event.target.value)} /></Field>
      </div>
      <label className="jk-check mt-4">
        <input type="checkbox" checked={draft.acceptsEmailMarketing} onChange={(event) => set("acceptsEmailMarketing", event.target.checked)} />
        <span><span className="jk-strong">Customer agreed to receive marketing emails</span>
          <span className="jk-cell-sub">Only tick this if they told you so. They can unsubscribe from any newsletter.</span></span>
      </label>
    </Card>
    <Card title="Address" description="Used as their default delivery address.">
      <div className="jk-grid-2">{ADDRESS_FIELDS.map((field) => <div key={field.key} style={field.wide ? { gridColumn: "1 / -1" } : undefined}>
        <Field id={`customer-${field.key}`} label={field.key === "country" ? <>Country code <HelpTip>Two letters, for example GB for the United Kingdom or IN for India.</HelpTip></> : field.label}>
          <input id={`customer-${field.key}`} maxLength={field.max} value={draft.address[field.key]} onChange={(event) => onChange({ ...draft, address: { ...draft.address, [field.key]: event.target.value } })} />
        </Field>
      </div>)}</div>
    </Card>
    <Card title="Notes and tags" description="Only you and your staff can see these.">
      <div className="jk-stack-sm">
        <Field id="customer-note" label="Note"><textarea id="customer-note" rows={3} maxLength={5000} value={draft.note} placeholder="For example, prefers morning delivery" onChange={(event) => set("note", event.target.value)} /></Field>
        <TagInput label="Tags" value={draft.tags} onChange={(tags) => set("tags", tags)} known={knownTags} help="Group customers, for example VIP or wholesale." />
      </div>
    </Card>
  </>;
}
