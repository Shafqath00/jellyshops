export interface DemoProduct {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  priceMinor: number;
  currency: "USD";
}

export interface DemoCollection {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  productIds: string[];
}

export interface DemoCatalog {
  products: DemoProduct[];
  collections: DemoCollection[];
}
