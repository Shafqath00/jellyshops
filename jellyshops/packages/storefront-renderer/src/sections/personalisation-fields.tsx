import { useId } from "react";
import type { ProductPresentationContext } from "../types";

/**
 * The product's personalisation fields (engraving, gift message, measurements) in the buying area. The text travels
 * with the cart line; the shop's API checks it again at checkout. A field's problem shows once the shopper tried to add.
 */
export function PersonalisationFields({ personalisation }: { personalisation: NonNullable<ProductPresentationContext["personalisation"]> }) {
  const id = useId();
  if (!personalisation.fields.length) return null;
  return <fieldset className="jelly-personalisation">
    <legend>Personalise it</legend>
    {personalisation.fields.map((field) => {
      const value = personalisation.values[field.id] ?? "";
      const inputId = `${id}-${field.id}`;
      const helpId = `${inputId}-help`;
      const problem = personalisation.problems?.[field.id];
      const describedBy = [field.helpText || field.maxLength ? helpId : "", problem ? `${inputId}-problem` : ""].filter(Boolean).join(" ") || undefined;
      const common = { id: inputId, value, maxLength: field.maxLength, required: field.required, "aria-invalid": problem ? true : undefined, "aria-describedby": describedBy, onChange: (event: { currentTarget: { value: string } }) => personalisation.setValue(field.id, event.currentTarget.value) };
      return <div key={field.id} className="jelly-personalisation-field">
        <label htmlFor={inputId}>
          {field.label}
          {!field.required && <span className="jelly-personalisation-optional"> (optional)</span>}
          {field.priceAdjustment && <span className="jelly-personalisation-price"> +{field.priceAdjustment}</span>}
        </label>
        {field.multiline ? <textarea rows={3} {...common} /> : <input type="text" autoComplete="off" {...common} />}
        <p className="jelly-personalisation-help" id={helpId}>
          {field.helpText && <span>{field.helpText}</span>}
          <span className="jelly-personalisation-count" aria-live="polite">{value.length}/{field.maxLength}</span>
        </p>
        {problem && <p className="jelly-personalisation-problem" id={`${inputId}-problem`} role="alert">{problem}</p>}
      </div>;
    })}
  </fieldset>;
}
