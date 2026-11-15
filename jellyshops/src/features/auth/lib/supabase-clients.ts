import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The sign-in clients, created on first use. The Supabase library is loaded with a dynamic import, so it is a file of
 * its own that downloads after the page is up instead of part of every store page's start-up JavaScript (about 56 KB
 * compressed). Merchant and customer sessions are separate clients (separate storage keys), as before.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Whether sign-in is set up for this deployment (known without loading the library). */
export const supabaseConfigured = Boolean(url && key);

let merchant: Promise<SupabaseClient | null> | undefined;
let customer: Promise<SupabaseClient | null> | undefined;

/** The merchant (admin) sign-in client, or null when sign-in is not set up. */
export function merchantSupabase(): Promise<SupabaseClient | null> {
  merchant ??= url && key
    ? import("@supabase/supabase-js").then(({ createClient }) => createClient(url, key, { auth: { flowType: "pkce", detectSessionInUrl: false } }))
    : Promise.resolve(null);
  return merchant;
}

/** The shopper (customer account) sign-in client. A customer session must never trigger the merchant provider's provisioning path. */
export function customerSupabase(): Promise<SupabaseClient | null> {
  customer ??= url && key
    ? import("@supabase/supabase-js").then(({ createClient }) => createClient(url, key, { auth: { storageKey: "jelly-customer-auth", flowType: "pkce", detectSessionInUrl: false } }))
    : Promise.resolve(null);
  return customer;
}
