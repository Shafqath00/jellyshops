"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AdminPage, ResourceForm, useToast } from "@/components/admin";
import { authApiOrigin, useAuth } from "@/features/auth/providers/auth-provider";
import { createAdminApi } from "@/features/admin/api/admin-api";
import { CustomerFormFields, draftToInput, emptyCustomer } from "@/features/admin/customers/customer-form";

export default function NewCustomerPage() {
  const { session, activeStore } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const api = useMemo(() => session ? createAdminApi({ baseUrl: authApiOrigin(), token: session.access_token }) : null, [session]);
  const [draft, setDraft] = useState(emptyCustomer);
  const dirty = JSON.stringify(draft) !== JSON.stringify(emptyCustomer);
  async function save() {
    if (!api || !activeStore) throw new Error("Sign in to your store first.");
    if (!draft.email.trim()) throw new Error("Add the customer's email address.");
    const { customer } = await api.createCustomer(activeStore.id, { ...draftToInput(draft), email: draft.email.trim() });
    setDraft(emptyCustomer);
    toast("Customer added");
    router.push(`/admin/customers/${encodeURIComponent(customer.id)}`);
  }
  return <AdminPage title="Add customer" width="detail" back={{ href: "/admin/customers", label: "Customers" }} description="Add someone who orders by phone or in person, so their details are ready for their next order.">
    <ResourceForm dirty={dirty} onSubmit={save} onDiscard={() => setDraft(emptyCustomer)} saveLabel="Save customer">
      <CustomerFormFields draft={draft} onChange={setDraft} />
    </ResourceForm>
  </AdminPage>;
}
