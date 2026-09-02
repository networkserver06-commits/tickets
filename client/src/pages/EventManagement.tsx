import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type EventForm = {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  venue: string;
  ticketPrice: string;
  capacity: string;
};

const emptyForm: EventForm = {
  id: "",
  title: "",
  description: "",
  eventDate: "",
  venue: "",
  ticketPrice: "",
  capacity: "",
};

async function readJson(response: Response) {
  return response.json().catch(() => ({ error: `Request failed (${response.status})` }));
}

export default function EventManagement() {
  const [events, setEvents] = useState<any[]>([]);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/management/events", { cache: "no-store" });
    const body = await readJson(response);
    if (!response.ok) throw new Error(body.error || "Unable to load events");
    setEvents(body.events || []);
    setLoading(false);
  }

  useEffect(() => {
    void load().catch(error => {
      setMessage(error instanceof Error ? error.message : "Unable to load events");
      setLoading(false);
    });
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setMessage("");
    setSaving(true);
    try {
      const response = await fetch("/api/management/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ticketPrice: Number(form.ticketPrice),
          capacity: Number(form.capacity),
        }),
      });
      const body = await readJson(response);
      if (!response.ok) {
        setMessage(body.error || "Unable to create event");
        return;
      }
      setMessage(`Event published. Customer link: ${window.location.origin}/event/${body.event.id}`);
      setForm(emptyForm);
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
        <input placeholder="Event ID (optional)" value={form.id} onChange={e => setForm({ ...form, id: e.target.value })} className="h-10 rounded-lg border px-3" />
        <input required placeholder="Event title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="h-10 rounded-lg border px-3" />
        <input type="date" placeholder="Event date" value={form.eventDate} onChange={e => setForm({ ...form, eventDate: e.target.value })} className="h-10 rounded-lg border px-3" />
        <input placeholder="Venue" value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} className="h-10 rounded-lg border px-3" />
        <input required type="number" min="1" placeholder="Ticket price in KES" value={form.ticketPrice} onChange={e => setForm({ ...form, ticketPrice: e.target.value })} className="h-10 rounded-lg border px-3" />
        <input required type="number" min="1" placeholder="Capacity" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className="h-10 rounded-lg border px-3" />
        <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="min-h-24 rounded-lg border p-3 sm:col-span-2" />
        <Button disabled={saving} type="submit" className="sm:col-span-2">{saving ? "Publishing…" : "Publish event"}</Button>
        {message && <p className="text-sm text-slate-600 sm:col-span-2">{message}</p>}
      </form>
      <div className="space-y-3">
        {loading ? <p className="text-sm text-slate-500">Loading published events…</p> : events.length === 0 ? <p className="rounded-xl border bg-white p-4 text-sm text-slate-500">No events published yet.</p> : events.map(e => (
          <div key={e.id} className="rounded-xl border bg-white p-4">
            <p className="font-medium">{e.title}</p>
            <p className="text-sm text-slate-500">{e.eventDate || "Date to be announced"}{e.venue ? ` · ${e.venue}` : ""}</p>
            <a className="mt-2 block text-sm font-medium text-indigo-600 hover:underline" href={`/event/${encodeURIComponent(e.id)}`}>Open customer checkout</a>
          </div>
        ))}
      </div>
    </div>
  );
}
