import type { Currency } from "./domain";

export interface AuthProvider {
  getSession(): Promise<{ user: { id: string; name: string; email: string }; businessId: string; storeId: string }>;
}

export interface PaymentProvider {
  confirm(input: { amount: number; currency: Currency }): Promise<{ id: string; status: "PAID" }>;
}

export interface AssetProvider {
  resolve(url?: string): string;
}

export const mockAuth: AuthProvider = {
  async getSession() {
    return {
      user: { id: "user-maya", name: "Maya Kapoor", email: "maya@jelly.shop" },
      businessId: "business-jelly",
      storeId: "store-sweet-bakes"
    };
  }
};

export const mockPayments: PaymentProvider = {
  async confirm({ amount, currency }) {
    await Promise.resolve();
    return { id: `mock_payment_${amount}_${currency}`, status: "PAID" };
  }
};

const fallbackImage = "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=1200&q=85";

export const mockAssets: AssetProvider = {
  resolve(url) {
    return url?.trim() || fallbackImage;
  }
};
