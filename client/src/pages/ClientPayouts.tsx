import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Client = {
  id: string;
  businessName: string;
  email: string;
  phone: string;
  paystackSubaccountCode: string;
  platformFeePercentage?: number;
};
export default function ClientPayouts() {
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    businessName: "",
    email: "",
    phone: "",
    paystackSubaccountCode: "",
    platformFeePercentage: "10",
  });
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/management/clients", { cache: "no-store", credentials: "same-origin" });
      const payload = await response
        .json()
        .catch(() => ({ error: `Request failed (${response.status})` }));
      if (!response.ok)
        throw new Error(payload.error || "Unable to load clients");
      setClients(payload.clients || []);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to load clients"
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const response = await fetch("/api/management/clients", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...form, id: editingId } : form),
      });
      const payload = await response
        .json()
        .catch(() => ({ error: `Request failed (${response.status})` }));
      if (!response.ok)
        throw new Error(payload.error || "Unable to save client");
      setForm({
        businessName: "",
        email: "",
        phone: "",
        paystackSubaccountCode: "",
        platformFeePercentage: "10",
      });
      setSuccess(
        editingId ? "Payout profile updated." : "Payout profile created."
      );
      setEditingId(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save client");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-indigo-600">Payout routing</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">
          Client Paystack subaccounts
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Bind each organizer to an ACCT_ subaccount before creating their
          events.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add client payout profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <input
              required
              placeholder="Business name"
              value={form.businessName}
              onChange={e => setForm({ ...form, businessName: e.target.value })}
              className="h-10 rounded-lg border px-3"
            />
            <input
              required
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="h-10 rounded-lg border px-3"
            />
            <input
              required
              placeholder="Phone"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              className="h-10 rounded-lg border px-3"
            />
            <input
              required
              placeholder="ACCT_ subaccount code"
              value={form.paystackSubaccountCode}
              onChange={e =>
                setForm({ ...form, paystackSubaccountCode: e.target.value })
              }
              className="h-10 rounded-lg border px-3"
            />
            <input
              required
              min="0"
              max="100"
              type="number"
              placeholder="Platform fee %"
              value={form.platformFeePercentage}
              onChange={e =>
                setForm({ ...form, platformFeePercentage: e.target.value })
              }
              className="h-10 rounded-lg border px-3"
            />
            <div className="sm:col-span-2">
              <Button disabled={saving} type="submit">
                {saving ? "Saving…" : editingId ? "Update payout profile" : "Save payout profile"}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="ghost"
                  className="ml-2"
                  onClick={() => {
                    setEditingId(null);
                    setForm({
                      businessName: "",
                      email: "",
                      phone: "",
                      paystackSubaccountCode: "",
                      platformFeePercentage: "10",
                    });
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
          {success && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {success}
            </p>
          )}
          {error && (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saved clients</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading payout profiles…</p>
          ) : clients.length === 0 ? (
            <p className="text-sm text-slate-500">
              No client payout profiles yet.
            </p>
          ) : (
            <div className="space-y-3">
              {clients.map(client => (
                <div
                  key={client.id}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-slate-100 p-4 sm:flex-row"
                >
                  <div>
                    <p className="font-medium">{client.businessName}</p>
                    <p className="text-sm text-slate-500">
                      {client.email} · {client.phone}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-indigo-50 px-3 py-1 font-mono text-xs text-indigo-700">
                      {client.paystackSubaccountCode}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(client.id);
                        setForm({
                          businessName: client.businessName,
                          email: client.email,
                          phone: client.phone,
                          paystackSubaccountCode: client.paystackSubaccountCode,
                          platformFeePercentage: String(
                            client.platformFeePercentage ?? 10
                          ),
                        });
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
