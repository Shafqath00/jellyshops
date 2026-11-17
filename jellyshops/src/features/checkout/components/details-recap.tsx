import { addressWording, type CheckoutDetails } from "../checkout-model";

interface DetailsRecapProps {
  details: CheckoutDetails;
  delivery: boolean;
  country: string;
  onEdit: () => void;
}

/** The contact and delivery details, folded to a short list once payment is ready. */
export function DetailsRecap({ details, delivery, country, onEdit }: DetailsRecapProps) {
  const address = [details.line1, details.line2, details.city, details.region, details.postalCode, addressWording(country).countryName].filter((part) => part.trim()).join(", ");
  return (
    <section className="jelly-checkout__panel jelly-checkout__recap" aria-label="Your details">
      <dl>
        <div><dt>Contact</dt><dd>{details.name} · {details.email}</dd></div>
        {delivery && <div><dt>Deliver to</dt><dd>{address}</dd></div>}
      </dl>
      <button type="button" className="jelly-checkout__link" onClick={onEdit} aria-label="Change your details">Change</button>
    </section>
  );
}
