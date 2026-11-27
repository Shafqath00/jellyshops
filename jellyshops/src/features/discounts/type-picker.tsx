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
 * Step one of creating a discount: what the customer gets (four cards with an example each) and how they get it
 * (a code or automatically). Templates skip both. The form is the next page and never asks again.
 */
export function DiscountTypePicker({ open, onOpenChange, onChoose, initial }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (href: string) => void;
  /** Starting choice, e.g. when changing the type of a new discount. */
  initial?: { type: DiscountType; method: DiscountMethod };
}) {
  const [type, setType] = useState<DiscountType>(initial?.type ?? "product_amount");
  const [method, setMethod] = useState<DiscountMethod>(initial?.method ?? "code");
  const id = useId();
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="jk-overlay" />
      <DialogPrimitive.Content className="jk-dialog jk-dialog-wide jk-discount-picker" aria-describedby={undefined}>
        <DialogPrimitive.Title className="jk-dialog-title">Create discount</DialogPrimitive.Title>
        <div className="jk-dialog-body jk-dialog-scroll">
          <fieldset className="jk-discount-choice">
            <legend>What does the customer get?</legend>
            <div className="jk-discount-types">
              {DISCOUNT_TYPES.map((value) => {
                const info = DISCOUNT_TYPE_INFO[value];
                const Icon = info.icon;
                return <label key={value} className="jk-discount-type" data-checked={type === value ? "" : undefined}>
                  <input type="radio" name={`${id}-type`} value={value} checked={type === value} onChange={() => setType(value)} aria-describedby={`${id}-${value}`} />
                  <span className="jk-discount-type-icon" aria-hidden="true"><Icon size={18} /></span>
                  <span className="jk-discount-type-text">
                    <strong>{info.label}</strong>
                    <span id={`${id}-${value}`}>{info.explain} <em>e.g. {info.example}</em></span>
                  </span>
                </label>;
              })}
            </div>
          </fieldset>
          <fieldset className="jk-discount-choice">
            <legend>How do customers get it?</legend>
            <div className="jk-segmented jk-segmented-wide" role="radiogroup" aria-label="How do customers get it?">
              {DISCOUNT_METHODS.map((value) => {
                const Icon = DISCOUNT_METHOD_INFO[value].icon;
                return <label key={value}><input type="radio" name={`${id}-method`} value={value} checked={method === value} onChange={() => setMethod(value)} /><Icon size={15} aria-hidden="true" /> {DISCOUNT_METHOD_INFO[value].label}</label>;
              })}
            </div>
            <p className="jk-muted jk-discount-help">{DISCOUNT_METHOD_INFO[method].explain}</p>
          </fieldset>
          <section className="jk-discount-templates" aria-labelledby={`${id}-templates`}>
            <h3 id={`${id}-templates`}>Or start from a template</h3>
            <ul>
              {DISCOUNT_TEMPLATES.map((template) => <li key={template.id}>
                <button type="button" className="jk-discount-template-chip" onClick={() => onChoose(newDiscountHref({ template: template.id }))}>{template.title}</button>
              </li>)}
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
