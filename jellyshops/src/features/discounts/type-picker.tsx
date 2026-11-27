"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useId, useState } from "react";
import { DISCOUNT_METHODS, DISCOUNT_TYPES, type DiscountMethod, type DiscountType } from "@jelly/storefront-schema";
import { Button } from "@/components/admin";
import { DISCOUNT_METHOD_INFO, DISCOUNT_TYPE_INFO } from "./discount-words";
import { DISCOUNT_TEMPLATES } from "./templates";

/** Where "Continue" or a template leads: the form, with the choice in the address. */
export function newDiscountHref(choice: { type: DiscountType; method: DiscountMethod } | { template: string }): string {
  const query = "template" in choice ? `template=${encodeURIComponent(choice.template)}` : `type=${choice.type}&method=${choice.method}`;
  return `/admin/discounts/new?${query}`;
}

/**
 * Step one of creating a discount: what kind it is (with an example of each) and how customers get it.
 * Quick-start templates skip both choices. The form itself is the next page.
 */
export function DiscountTypePicker({ open, onOpenChange, onChoose }: { open: boolean; onOpenChange: (open: boolean) => void; onChoose: (href: string) => void }) {
  const [type, setType] = useState<DiscountType>("product_amount");
  const [method, setMethod] = useState<DiscountMethod>("code");
  const id = useId();
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="jk-overlay" />
      <DialogPrimitive.Content className="jk-dialog jk-dialog-wide jk-discount-picker" aria-describedby={`${id}-intro`}>
        <DialogPrimitive.Title className="jk-dialog-title">Create discount</DialogPrimitive.Title>
        <div className="jk-dialog-body jk-dialog-scroll">
          <p id={`${id}-intro`} className="jk-muted">Choose what the customer gets. You can set who qualifies, dates and limits on the next page.</p>
          <fieldset className="jk-discount-choice">
            <legend>What kind of discount?</legend>
            <div className="jk-discount-types">
              {DISCOUNT_TYPES.map((value) => {
                const info = DISCOUNT_TYPE_INFO[value];
                const Icon = info.icon;
                return <label key={value} className="jk-discount-type" data-checked={type === value ? "" : undefined}>
                  <input type="radio" name={`${id}-type`} value={value} checked={type === value} onChange={() => setType(value)} aria-describedby={`${id}-${value}`} />
                  <span className="jk-discount-type-icon" aria-hidden="true"><Icon size={18} /></span>
                  <span className="jk-discount-type-text">
                    <strong>{info.label}</strong>
                    <span id={`${id}-${value}`}>{info.explain} <em>For example: {info.example}.</em></span>
                  </span>
                </label>;
              })}
            </div>
          </fieldset>
          <fieldset className="jk-discount-choice">
            <legend>How do customers get it?</legend>
            <div className="jk-discount-methods">
              {DISCOUNT_METHODS.map((value) => {
                const info = DISCOUNT_METHOD_INFO[value];
                const Icon = info.icon;
                return <label key={value} className="jk-discount-type" data-checked={method === value ? "" : undefined}>
                  <input type="radio" name={`${id}-method`} value={value} checked={method === value} onChange={() => setMethod(value)} aria-describedby={`${id}-m-${value}`} />
                  <span className="jk-discount-type-icon" aria-hidden="true"><Icon size={18} /></span>
                  <span className="jk-discount-type-text"><strong>{info.label}</strong><span id={`${id}-m-${value}`}>{info.explain}</span></span>
                </label>;
              })}
            </div>
          </fieldset>
          <section className="jk-discount-templates" aria-labelledby={`${id}-templates`}>
            <h3 id={`${id}-templates`}>Or start from a template</h3>
            <ul>
              {DISCOUNT_TEMPLATES.map((template) => {
                const Icon = DISCOUNT_TYPE_INFO[template.type].icon;
                return <li key={template.id}>
                  <button type="button" className="jk-discount-template" onClick={() => onChoose(newDiscountHref({ template: template.id }))}>
                    <Icon size={16} aria-hidden="true" />
                    <span><strong>{template.title}</strong><span>{template.description}</span></span>
                  </button>
                </li>;
              })}
            </ul>
          </section>
        </div>
        <div className="jk-dialog-footer">
          <DialogPrimitive.Close asChild><Button>Cancel</Button></DialogPrimitive.Close>
          <Button variant="primary" onClick={() => onChoose(newDiscountHref({ type, method }))}>Continue</Button>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
