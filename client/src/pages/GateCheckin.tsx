import { AlertTriangle, Camera, CheckCircle2, ChevronRight, Clock3, CreditCard, KeyRound, Loader2, ScanLine, ShieldCheck, Ticket, UserRound, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type GateTicket = {
  eventTitle?: string | null;
  eventDate?: string | null;
  venue?: string | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  paymentReference?: string | null;
  amount?: number | null;
  scannedAt?: string | null;
  usedAt?: string | null;
};

function ticketFromScan(value: string) {
  const clean = value.trim();
  try {
    const url = new URL(clean);
    return url.searchParams.get("ticket") || url.pathname.split("/").filter(Boolean).pop() || clean;
  } catch {
    return clean;
  }
}

function formatKes(minorUnits: number | null | undefined) {
  if (typeof minorUnits !== "number" || !Number.isFinite(minorUnits)) return "Payment confirmed";
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(minorUnits / 100);
}

export default function GateCheckin() {
  const [pin, setPin] = useState(() => sessionStorage.getItem("passage_gate_pin") || "");
  const [ticketId, setTicketId] = useState(() => new URLSearchParams(window.location.search).get("ticket") || "");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [result, setResult] = useState<"approved" | "rejected" | "used" | "idle">("idle");
  const [ticket, setTicket] = useState<GateTicket | null>(null);
  const [entryConfirmed, setEntryConfirmed] = useState(false);
  const [toast, setToast] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const lastRequestRef = useRef("");

  function stopCamera() {
    if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function startCamera() {
    setCameraError("");
    if (!("mediaDevices" in navigator) || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported on this browser. Enter the ticket ID manually.");
      return;
    }
    const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: new (options?: { formats?: string[] }) => { detect: (video: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
    if (!BarcodeDetectorCtor) {
      setCameraError("QR scanning is not supported on this browser. Enter the ticket ID manually.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
      const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      const scan = async () => {
        const video = videoRef.current;
        if (!video || !streamRef.current) return;
        try {
          const codes = await detector.detect(video);
          const raw = codes[0]?.rawValue;
          if (raw) {
            const extractedId = ticketFromScan(raw);
            setTicketId(extractedId);
            setPhone("");
            stopCamera();
            if (pin.trim()) void checkin(extractedId, "");
            else setMessage("QR ticket captured. Enter the staff PIN, then approve entry.");
            return;
          }
        } catch {
          // Keep scanning; transient camera frames can fail detection.
        }
        scanTimerRef.current = window.setTimeout(scan, 280);
      };
      window.setTimeout(scan, 350);
    } catch {
      setCameraError("Camera permission was denied or unavailable. Enter the ticket ID manually.");
      stopCamera();
    }
  }

  useEffect(() => () => stopCamera(), []);
  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play();
    }
  }, [cameraOn]);

  async function checkin(requestedTicketId = ticketId, requestedPhone = phone) {
    const nextTicketId = requestedTicketId.trim();
    const nextPhone = requestedPhone.trim();
    if (!pin.trim() || (!nextTicketId && !nextPhone) || busy) return;
    const requestKey = `${nextTicketId}|${nextPhone}`;
    if (lastRequestRef.current === requestKey && result === "approved") return;
    lastRequestRef.current = requestKey;
    setBusy(true); setMessage(""); setResult("idle"); setTicket(null); setEntryConfirmed(false);
    try {
      const params = new URLSearchParams(nextTicketId ? { ticketId: nextTicketId } : { phone: nextPhone });
      const response = await fetch(`/api/gate/checkin?${params.toString()}`, { headers: { "x-gate-pin": pin }, cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (response.ok) { sessionStorage.setItem("passage_gate_pin", pin.trim()); setResult("approved"); setTicket(body.ticket || null); setMessage("Ticket valid — confirm entry to admit this guest"); setToast("Ticket is valid. Review the details, then confirm entry."); }
      else if (response.status === 409) { setResult("used"); setTicket(body.ticket || (body.usedAt ? { scannedAt: body.usedAt, usedAt: body.usedAt } : null)); setEntryConfirmed(true); setMessage(body.error || "Ticket is already used or unavailable"); }
      else { setResult("rejected"); setMessage(body.error || "Unable to verify this ticket"); }
    } catch { setResult("rejected"); setMessage("Network error. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  async function confirmEntry() {
    if (!pin.trim() || (!ticketId.trim() && !phone.trim()) || busy || entryConfirmed) return;
    setBusy(true);
    try {
      const response = await fetch("/api/gate/checkin", { method: "POST", headers: { "Content-Type": "application/json", "x-gate-pin": pin }, body: JSON.stringify({ ticketId: ticketId.trim(), phone: phone.trim(), confirm: true }) });
      const body = await response.json().catch(() => ({}));
      if (response.ok) { setEntryConfirmed(true); setTicket(body.ticket || ticket); setMessage("Entry confirmed — ticket marked used"); setToast("Entry confirmed. This ticket is now used."); }
      else if (response.status === 409) { setResult("used"); setEntryConfirmed(true); setTicket(body.ticket || ticket); setMessage(body.error || "Ticket has already been used"); }
      else setMessage(body.error || "Unable to confirm entry");
    } catch { setMessage("Network error. Entry was not confirmed."); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!pin.trim() || result === "idle" || (!ticketId.trim() && !phone.trim())) return;
    let active = true;
    const refresh = async () => {
      const params = new URLSearchParams(ticketId.trim() ? { ticketId: ticketId.trim() } : { phone: phone.trim() });
      try {
        const response = await fetch(`/api/gate/checkin?${params.toString()}`, { headers: { "x-gate-pin": pin.trim() }, cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!active) return;
        if (response.status === 409) {
          setResult("used");
          setTicket(body.ticket || (body.usedAt ? { scannedAt: body.usedAt, usedAt: body.usedAt } : null));
          setMessage(body.error || "Ticket has already been used");
        } else if (response.ok && result === "used") {
          setResult("approved");
          setTicket(body.ticket || null);
          setMessage("Entry approved");
        }
      } catch {
        // The active result remains visible; the next interval retries automatically.
      }
    };
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [pin, phone, result, ticketId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function endShift() {
    sessionStorage.removeItem("passage_gate_pin");
    setPin("");
    reset();
  }

  function reset() {
    lastRequestRef.current = "";
    setTicketId(""); setPhone(""); setMessage(""); setTicket(null); setResult("idle"); setEntryConfirmed(false);
  }

  return <main className="gate-control-root min-h-screen bg-[#070b1a] px-4 py-5 text-white sm:px-6"><div className="mx-auto max-w-lg">{toast && <div role="status" className="fixed left-4 right-4 top-4 z-50 mx-auto max-w-lg rounded-xl border border-emerald-300/30 bg-emerald-950/95 px-4 py-3 text-center text-sm font-semibold text-emerald-100 shadow-2xl">{toast}</div>}<header className="mb-5 flex items-center justify-between"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-indigo-950/40"><Ticket className="h-5 w-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-indigo-300">Lee Tech · Passage</p><h1 className="mt-1 text-xl font-semibold tracking-tight">Gate control</h1></div></div><div className="flex items-center gap-2"><span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300"><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />Live</span>{pin && <button type="button" onClick={endShift} className="text-[10px] font-semibold text-slate-400 underline-offset-2 hover:text-white hover:underline">End shift</button>}</div></header><section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-indigo-500/20 via-violet-500/10 to-white/[0.03] p-5 shadow-2xl shadow-black/20"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-300" /><div><h2 className="font-semibold">Verify guests securely</h2><p className="mt-1 text-sm leading-6 text-slate-300">Scan the customer QR code or enter one ticket ID. Each valid ticket can be admitted once.</p></div></div><div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4"><label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><KeyRound className="h-3.5 w-3.5" /> Staff access {pin && <span className="ml-auto font-normal normal-case tracking-normal text-emerald-300">PIN active for this shift</span>}</label><input className="h-12 w-full rounded-xl border border-white/10 bg-white/10 px-4 text-white outline-none placeholder:text-slate-500 focus:border-indigo-400" type="password" placeholder="Enter gate PIN" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && (ticketId.trim() || phone.trim())) void checkin(); }} autoComplete="off" /></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Button type="button" onClick={cameraOn ? stopCamera : startCamera} className="h-12 rounded-xl border border-indigo-300/20 bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"><Camera className="mr-2 h-4 w-4" />{cameraOn ? "Close scanner" : "Scan QR code"}</Button><div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-400"><ScanLine className="h-4 w-4 text-indigo-300" /> Fast scan · PIN remembered for this shift</div></div>{cameraOn && <div className="relative isolate mt-4 overflow-hidden rounded-2xl border border-indigo-400/40 bg-black"><video ref={videoRef} className="block aspect-video w-full object-cover transform-none will-change-auto" playsInline muted /><div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/90" /><p className="absolute bottom-3 left-3 right-3 rounded-lg bg-black/65 px-3 py-2 text-center text-xs font-semibold text-white">Align the QR code inside the frame</p></div>}{cameraError && <p className="mt-3 rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-200">{cameraError}</p>}<div className="my-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500"><span className="h-px flex-1 bg-white/10" />Manual verification<span className="h-px flex-1 bg-white/10" /></div><div className="space-y-3"><div className="relative"><Ticket className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" /><input className="h-12 w-full rounded-xl border border-white/10 bg-white/10 pl-10 pr-3 text-white outline-none placeholder:text-slate-500 focus:border-indigo-400" placeholder="Ticket ID from the customer pass" value={ticketId} onChange={e => { setTicketId(e.target.value); setPhone(""); }} onKeyDown={e => { if (e.key === "Enter") void checkin(); }} /></div><p className="text-center text-xs text-slate-500">For multiple tickets, scan or enter each ticket ID separately.</p><div className="relative"><UserRound className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" /><input className="h-12 w-full rounded-xl border border-white/10 bg-white/10 pl-10 pr-3 text-white outline-none placeholder:text-slate-500 focus:border-indigo-400" placeholder="Or find one valid ticket by phone" value={phone} onChange={e => { setPhone(e.target.value); setTicketId(""); }} onKeyDown={e => { if (e.key === "Enter") void checkin(); }} /></div><Button disabled={busy || !pin || (!ticketId.trim() && !phone.trim())} onClick={() => void checkin()} className="h-13 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-base font-semibold shadow-lg shadow-indigo-950/50 hover:from-indigo-400 hover:to-violet-400">{busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Checking payment and ticket…</> : <><ShieldCheck className="mr-2 h-4 w-4" />Approve entry</>}</Button></div></section>{message && <section className={`mt-4 overflow-hidden rounded-[1.5rem] border p-5 ${result === "approved" ? "border-emerald-400/25 bg-emerald-400/10" : result === "used" ? "border-amber-400/25 bg-amber-400/10" : "border-rose-400/25 bg-rose-400/10"}`}><div className="flex items-start gap-3">{result === "approved" ? <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-300" /> : result === "used" ? <Clock3 className="mt-0.5 h-6 w-6 text-amber-300" /> : <XCircle className="mt-0.5 h-6 w-6 text-rose-300" />}<div className="min-w-0 flex-1"><h2 className="text-lg font-semibold">{message}</h2>{result === "approved" && <p className="mt-1 text-sm text-emerald-100/70">This ticket is valid. Confirm entry to mark it used and allow the guest to enter.</p>}{result === "used" && <p className="mt-1 text-sm text-amber-100/70">Do not admit this pass unless an event manager resolves the issue.</p>}{result === "rejected" && <p className="mt-1 text-sm text-rose-100/70">Ask the guest to show the original ticket email or contact support.</p>}</div></div>{ticket && <div className="mt-4 grid gap-3 rounded-2xl bg-black/20 p-4 text-sm sm:grid-cols-2"><div className="sm:col-span-2"><p className="text-xs text-slate-400">Event</p><p className="mt-1 font-semibold">{ticket.eventTitle || "Passage event"}</p>{ticket.eventDate && <p className="mt-1 text-xs text-slate-400">{ticket.eventDate}{ticket.venue ? ` · ${ticket.venue}` : ""}</p>}</div><div><p className="text-xs text-slate-400">Guest</p><p className="mt-1 font-semibold">{ticket.buyerName || "Guest"}</p><p className="mt-1 break-all text-xs text-slate-400">{ticket.buyerPhone || ticket.buyerEmail || "—"}</p></div><div><p className="text-xs text-slate-400">Payment</p><p className="mt-1 flex items-center gap-1 font-semibold text-emerald-300"><CreditCard className="h-3.5 w-3.5" />{formatKes(ticket.amount)}</p><p className="mt-1 break-all font-mono text-[10px] text-slate-500">{ticket.paymentReference || "Confirmed"}</p></div>{result === "used" && ticket.scannedAt && <div className="sm:col-span-2"><p className="text-xs text-slate-400">Used at</p><p className="mt-1 font-semibold text-amber-200">{new Intl.DateTimeFormat("en-KE", { timeZone: "Africa/Nairobi", dateStyle: "medium", timeStyle: "short" }).format(new Date(ticket.scannedAt || ticket.usedAt || ""))}</p></div>}</div>}<div className="mt-4 flex gap-3">{result === "approved" && (entryConfirmed ? <Button onClick={reset} className="h-11 flex-1 rounded-xl bg-white text-slate-950 hover:bg-slate-100">Next ticket <ChevronRight className="ml-1 h-4 w-4" /></Button> : <Button onClick={() => void confirmEntry()} disabled={busy} className="h-11 flex-1 rounded-xl bg-emerald-500 text-white hover:bg-emerald-400">{busy ? "Confirming…" : "Confirm entry"}</Button>)}{result !== "approved" && <Button onClick={reset} className="h-11 flex-1 rounded-xl bg-white/10 text-white hover:bg-white/15">Clear and try again</Button>}</div></section>}<footer className="px-2 py-6 text-center text-xs leading-5 text-slate-500">Authorized bouncer console · One-time entry validation<br /><span className="text-slate-600">Powered by Lee Tech</span></footer></div></main>;
}
