export interface AuthProvider {
  getSession(): Promise<{ user: { id: string; name: string; email: string }; businessId: string; storeId: string }>;
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

const fallbackImage = "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=1200&q=85";

export const mockAssets: AssetProvider = {
  resolve(url) {
    return url?.trim() || fallbackImage;
  }
};
