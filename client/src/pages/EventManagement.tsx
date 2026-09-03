import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Client = { id: string; businessName: string; email: string; paystackSubaccountCode: string; platformFeePercentage?: number };
type EventForm = {
  clientId: string;
  id: string;
  title: string;
  description: string;
  eventDate: string;
  venue: string;
  ticketPrice: string;
  capacity: string;
  imageUrl: string;
};

const emptyForm: EventForm = {
  clientId: "",
  id: "",
  title: "",
  description: "",
  eventDate: "",
  venue: "",
  ticketPrice: "",
  capacity: "",
  imageUrl: "",
};

async function readJson(response: Response) {
  return response.json().catch(() => ({ error: `Request failed (${response.status})` }));
}

export default function EventManagement() {
  const [events, setEvents] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [response, clientResponse] = await Promise.all([fetch("/api/management/events", { cache: "no-store", credentials: "same-origin" }), fetch("/api/management/clients", { cache: "no-store", credentials: "same-origin" })]);
    const body = await readJson(response); const clientBody = await readJson(clientResponse);
    if (!response.ok) throw new Error(body.error || "Unable to load events");
    if (!clientResponse.ok) throw new Error(clientBody.error || "Unable to load payout accounts");
    setEvents(body.events || []);
    setClients(clientBody.clients || []);
    setLoading(false);
  }

  useEffect(() => {
    void load().catch(error => {
      setMessage(error instanceof Error ? error.message : "Unable to load events");
      setLoading(false);
    });
  }, []);

  async function removeEvent(id: string, title: string) {
    if (!window.confirm(`Remove the event “${title}”? This cannot be undone.`)) return;
    setMessage("");
    const response = await fetch(`/api/management/events?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" });
    const body = await readJson(response);
    if (!response.ok) {
      setMessage(body.error || "Unable to remove event");
      return;
    }
    setMessage("Event removed.");
    await load();
  }

  async function uploadImage(file: File) {
    if (!file.type.startsWith("image/") || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Upload a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Image must be 5 MB or smaller.");
      return;
    }
    setUploading(true);
    setMessage("");
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = () => reject(new Error("Unable to read image"));
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/management/event-image", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ data, contentType: file.type, filename: file.name }) });
      const body = await readJson(response);
      if (!response.ok) throw new Error(body.error || "Unable to upload image");
      setForm(current => ({ ...current, imageUrl: body.imageUrl }));
      setMessage("Image uploaded. Publish the event to save it.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload image");
    } finally {
      setUploading(false);
    }
  }

  const selectedClient = clients.find(client => client.id === form.clientId);
  const price = Number(form.ticketPrice);
  const capacity = Number(form.capacity);
  const fee = selectedClient?.platformFeePercentage ?? 10;
  const projectedGross = Number.isInteger(price) && price > 0 && Number.isInteger(capacity) && capacity > 0 ? price * capacity : 0;
  const projectedNet = projectedGross * (100 - fee) / 100;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setMessage("");
    if (!form.clientId) {
      setMessage("Select the payout account that should receive this event’s payments.");
      return;
    }
    if (!Number.isInteger(price) || price <= 0 || !Number.isInteger(capacity) || capacity <= 0) {
      setMessage("Ticket price and capacity must be positive whole numbers.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(editingId ? `/api/management/events?id=${encodeURIComponent(editingId)}` : "/api/management/events", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          clientId: form.clientId,
          ticketPrice: Math.round(Number(form.ticketPrice) * 100),
          capacity: Number(form.capacity),
          imageUrl: form.imageUrl,
        }),
      });
      const body = await readJson(response);
      if (!response.ok) {
        setMessage(body.error || "Unable to create event");
        return;
      }
      setMessage(`${editingId ? "Event updated" : "Event published"}. Customer link: ${window.location.origin}/event/${body.event.id}`);
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create event");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-indigo-600">Event operations</p>
        <h2 className="mt-1 text-2xl font-semibold">Publish a live event</h2>
        <p className="mt-1 text-sm text-slate-500">Complete the event details below. The event is published immediately and receives its own checkout link.</p>
      </div>
      <form onSubmit={submit} className="grid gap-3 rounded-2xl bg-white p-6 shadow-sm sm:grid-cols-2">
        <select required value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })} className="h-10 rounded-lg border px-3 sm:col-span-2"><option value="">Select payout account</option>{clients.map(client => <option key={client.id} value={client.id}>{client.businessName} · {client.paystackSubaccountCode} · {client.platformFeePercentage ?? 10}% fee</option>)}</select><input disabled={Boolean(editingId)} placeholder="Event ID (optional)" value={form.id} onChange={e => setForm({ ...form, id: e.target.value })} className="h-10 rounded-lg border px-3" />
        <input required placeholder="Event title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="h-10 rounded-lg border px-3" />
        <input type="date" placeholder="Event date" value={form.eventDate} onChange={e => setForm({ ...form, eventDate: e.target.value })} className="h-10 rounded-lg border px-3" />
        <input placeholder="Venue" value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} className="h-10 rounded-lg border px-3" />
        <input required type="number" step="1" min="1" placeholder="Ticket price in KES" value={form.ticketPrice} onChange={e => setForm({ ...form, ticketPrice: e.target.value })} className="h-10 rounded-lg border px-3" />
        <input required type="number" step="1" min="1" placeholder="Capacity" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className="h-10 rounded-lg border px-3" />
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-indigo-50 p-4 text-sm sm:col-span-2"><div><span className="block text-slate-500">Gross potential</span><strong className="text-lg text-slate-950">KSh {projectedGross.toLocaleString("en-KE")}</strong></div><div><span className="block text-slate-500">After {fee}% platform fee</span><strong className="text-lg text-emerald-700">KSh {projectedNet.toLocaleString("en-KE")}</strong></div><p className="col-span-2 text-xs text-slate-500">Projected at full capacity. Paystack processing fees are not included.</p></div>
        <label className="sm:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Event image</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || saving} onChange={e => { const file = e.target.files?.[0]; if (file) void uploadImage(file); }} className="block w-full rounded-lg border bg-white px-3 py-2 text-sm" />{uploading && <span className="mt-2 block text-xs text-slate-500">Uploading image…</span>}{form.imageUrl && <img src={form.imageUrl} alt="Event preview" className="mt-3 h-36 w-full rounded-xl object-cover" />}</label>
        <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="min-h-24 rounded-lg border p-3 sm:col-span-2" />
        <div className="flex gap-3 sm:col-span-2"><Button disabled={saving || uploading || clients.length === 0} type="submit">{saving ? "Saving…" : editingId ? "Save event changes" : "Publish event"}</Button>{editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel edit</Button>}</div>
        {message && <p className="text-sm text-slate-600 sm:col-span-2">{message}</p>}
      </form>
      <div className="space-y-3">
        {loading ? <p className="text-sm text-slate-500">Loading published events…</p> : events.length === 0 ? <p className="rounded-xl border bg-white p-4 text-sm text-slate-500">No events published yet.</p> : events.map(e => (
          <div key={e.id} className="rounded-xl border bg-white p-4">
            <div className="flex flex-wrap justify-between gap-3"><div><p className="font-medium">{e.title}</p><p className="text-sm text-slate-500">{e.eventDate || "Date to be announced"}{e.venue ? ` · ${e.venue}` : ""}</p><p className="mt-1 text-xs text-indigo-600">Payout: {clients.find(client => client.id === e.clientId)?.businessName || "Selected account"} · {e.paystackSubaccountCode}</p></div><div className="text-right text-sm"><p className="font-semibold text-slate-900">KSh {(Number(e.ticketPrice || 0) * Number(e.soldCount || 0)).toLocaleString("en-KE")} paid</p><p className="text-xs text-slate-500">{e.soldCount || 0} / {e.capacity} tickets sold</p></div></div>
            <div className="mt-2 flex flex-wrap items-center gap-4"><a className="text-sm font-medium text-indigo-600 hover:underline" href={`/event/${encodeURIComponent(e.id)}`}>Open customer checkout</a><button type="button" className="text-sm font-medium text-slate-600 hover:underline" onClick={() => { setEditingId(e.id); setForm({ id: e.id, clientId: e.clientId || "", title: e.title || "", description: e.description || "", eventDate: e.eventDate || "", venue: e.venue || "", ticketPrice: e.ticketPrice ? String(Number(e.ticketPrice) / 100) : "", capacity: String(e.capacity || ""), imageUrl: e.imageUrl || "" }); }}>Edit</button><button type="button" className="text-sm font-medium text-rose-600 hover:underline" onClick={() => void removeEvent(e.id, e.title)}>Remove event</button></div>
          </div>
        ))}
      </div>
    </div>
  );
}
