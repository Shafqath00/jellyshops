import {
  CalendarDays, ChartColumn, CodeXml, CreditCard, FileSpreadsheet, Globe, History, LayoutTemplate, LifeBuoy, Lock, Mail, MapPin,
  Megaphone, Package, Rocket, Share2, ShieldCheck, ShoppingBag, Smartphone, Star, Store, Truck, Users, type LucideIcon,
} from "lucide-react";
import type { IconName } from "../home-content";

const ICONS: Record<IconName, LucideIcon> = {
  store: Store, layout: LayoutTemplate, package: Package, card: CreditCard, truck: Truck, chart: ChartColumn, megaphone: Megaphone,
  globe: Globe, share: Share2, bag: ShoppingBag, phone: Smartphone, users: Users, rocket: Rocket, code: CodeXml, shield: ShieldCheck,
  lock: Lock, lifebuoy: LifeBuoy, history: History, calendar: CalendarDays, sheet: FileSpreadsheet, map: MapPin, mail: Mail, star: Star,
};

/** One stroke width everywhere (DESIGN_TOKENS.md). */
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const Component = ICONS[name];
  return <Component size={size} strokeWidth={1.5} aria-hidden="true" />;
}

/** Official single-colour brand mark, drawn in the current text colour through a CSS mask. */
export function BrandMark({ slug, className }: { slug: string; className?: string }) {
  return <span className={className} aria-hidden="true" style={{ WebkitMaskImage: `url(/logos/${slug}.svg)`, maskImage: `url(/logos/${slug}.svg)` }} />;
}
