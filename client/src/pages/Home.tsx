import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, ClipboardList, Download, RefreshCw, Search, Settings, Ticket, TrendingUp, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocation } from "wouter";
import AdminLoginScreen from "@/components/AdminLoginScreen";
import { useAdminAuth } from "@/hooks/adminAuth";
import TransactionsTable from "./TransactionsTable";

type Order = { id: string; buyerEmail: string; totalAmount: number; createdAt: string | number | Date };
type TicketRow = { id: string; orderId: string; status: "valid" | "used" };

type Summary = { orders: Order[]; tickets: TicketRow[] };
const money = (value: number) => `KSh ${new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(value / 100)}`;
const dateLabel = (value: string | number | Date) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const emptySummary: Summary = { orders: [], tickets: [] };
export function shouldShowAdminLogin(isAuthenticated: boolean, authLoading: boolean) { return !authLoading && !isAuthenticated; }

export default function Home() {
  const [location] = useLocation();
  const { admin, loading: authLoading, isAuthenticated, login, logout } = useAdminAuth();
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    fetch("/api/dashboard/summary").then(async response => { if (!response.ok) throw new Error("Unable to load dashboard data"); return response.json(); }).then(data => { if (active) setSummary(data); }).catch(() => { if (active) setError("Dashboard data is temporarily unavailable."); }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [isAuthenticated]);

  if (authLoading) return <AdminLoginScreen loading onLogin={login} />;
  if (shouldShowAdminLogin(isAuthenticated, authLoading)) return <AdminLoginScreen onLogin={login} />;
  const adminPath = location.replace(/^\/admin/, "") || "/";
  return <DashboardLayout username={admin?.username} onLogout={logout}>{adminPath === "/" ? <Overview summary={summary} loading={loading} error={error} onRetry={() => window.location.reload()} /> : <SubPage path={adminPath} summary={summary} loading={loading} error={error} />}</DashboardLayout>;
}

function Overview({ summary, loading, error, onRetry }: { summary: Summary; loading: boolean; error: string; onRetry: () => void }) {
  const ticketsSold = summary.tickets.length;
  const revenue = summary.orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const chartData = useMemo(() => {
    const grouped = new Map<string, number>();
    summary.orders.slice().reverse().forEach(order => { const key = dateLabel(order.createdAt); grouped.set(key, (grouped.get(key) || 0) + order.totalAmount / 100); });
    return Array.from(grouped, ([date, sales]) => ({ date, sales }));
  }, [summary.orders]);

  return <div className="space-y-8">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-sm font-medium text-indigo-600">Monday, August 30, 2026</p><h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">Good morning, operator.</h1><p className="mt-2 max-w-xl text-sm text-slate-500">A calm view of your event’s momentum, ticket inventory, and entrance readiness.</p></div><Button variant="outline" className="w-fit gap-2 border-slate-200 bg-white" onClick={onRetry}><RefreshCw className="h-4 w-4" /> Refresh</Button></div>
    {error && <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{error}</span><button onClick={onRetry} className="font-semibold underline">Retry</button></div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="Total revenue" value={loading ? "—" : money(revenue)} detail="Across all paid orders" icon={CircleDollarSign} tint="indigo" />
      <Metric label="Tickets sold" value={loading ? "—" : ticketsSold.toLocaleString()} detail="Issued from successful payments" icon={Ticket} tint="violet" />
      <Metric label="Valid at the door" value={loading ? "—" : summary.tickets.filter(ticket => ticket.status === "valid").length.toLocaleString()} detail="Ready for the next scan" icon={CheckCircle2} tint="emerald" />
      <Metric label="Tickets used" value={loading ? "—" : summary.tickets.filter(ticket => ticket.status === "used").length.toLocaleString()} detail="Successfully admitted" icon={Activity} tint="slate" />
      <Metric label="Total scans" value={loading ? "—" : summary.tickets.filter(ticket => ticket.status === "used").length.toLocaleString()} detail="Verified at the door" icon={CheckCircle2} tint="indigo" />
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
      <Card className="overflow-hidden border-0 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.06)]"><CardHeader className="flex flex-row items-center justify-between pb-2"><div><CardTitle className="text-base">Recent sales</CardTitle><p className="mt-1 text-sm text-slate-500">Revenue movement from successful orders</p></div><span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><TrendingUp className="h-3.5 w-3.5" /> Live</span></CardHeader><CardContent className="pt-5"><div className="h-[260px] w-full">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#eef0f5" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={v => `KSh ${(v / 1000).toFixed(0)}k`} /><Tooltip formatter={(value: number) => [money(value * 100), "Sales"]} contentStyle={{ border: "0", borderRadius: "12px", boxShadow: "0 10px 30px rgba(15,23,42,.12)" }} /><Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={3} fill="url(#salesFill)" /></AreaChart></ResponsiveContainer> : <EmptyState icon={TrendingUp} title="Sales will appear here" description="Connect Paystack and your first successful order will start the trendline." />}</div></CardContent></Card>
      <Card className="border-0 bg-slate-950 text-white shadow-[0_16px_45px_rgba(15,23,42,0.12)]"><CardHeader><p className="text-sm font-medium text-slate-400">Entrance readiness</p><CardTitle className="mt-1 text-2xl tracking-tight">Your team is in control.</CardTitle></CardHeader><CardContent><div className="space-y-5"><Progress label="Valid tickets" value={ticketsSold ? (summary.tickets.filter(t => t.status === "valid").length / ticketsSold) * 100 : 0} color="bg-indigo-400" /><Progress label="Admitted guests" value={ticketsSold ? (summary.tickets.filter(t => t.status === "used").length / ticketsSold) * 100 : 0} color="bg-emerald-400" /><div className="border-t border-white/10 pt-4 text-sm text-slate-400">Ticket verification is atomic, so every scan has one clear outcome.</div></div></CardContent></Card>
    </div>
    <OrdersTable orders={summary.orders} tickets={summary.tickets} loading={loading} />
  </div>;
}

function Metric({ label, value, detail, icon: Icon, tint }: { label: string; value: string; detail: string; icon: typeof Ticket; tint: string }) { const tintClass = { indigo: "bg-indigo-50 text-indigo-600", violet: "bg-violet-50 text-violet-600", emerald: "bg-emerald-50 text-emerald-600", slate: "bg-slate-100 text-slate-600" }[tint] || "bg-slate-100 text-slate-600"; return <Card className="border-0 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.05)]"><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</p></div><span className={`grid h-10 w-10 place-items-center rounded-xl ${tintClass}`}><Icon className="h-5 w-5" /></span></div><p className="mt-4 text-xs text-slate-400">{detail}</p></CardContent></Card>; }
function Progress({ label, value, color }: { label: string; value: number; color: string }) { return <div><div className="mb-2 flex justify-between text-xs"><span className="text-slate-300">{label}</span><span className="font-semibold text-white">{Math.round(value)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(100, value)}%` }} /></div></div>; }
function OrdersTable({ orders, tickets, loading }: { orders: Order[]; tickets: TicketRow[]; loading: boolean }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const filtered = orders.filter(order => order.buyerEmail.toLowerCase().includes(query.toLowerCase()) || order.id.toLowerCase().includes(query.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  return <Card className="border-0 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.06)]"><CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-base">Recent orders</CardTitle><p className="mt-1 text-sm text-slate-500">The latest payment and admission activity</p></div><div className="flex gap-2"><label className="relative flex-1 sm:w-56"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input aria-label="Search orders" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Search orders" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-indigo-400" /></label><Button variant="ghost" className="gap-2 text-indigo-600 hover:bg-indigo-50"><Download className="h-4 w-4" /> Export</Button></div></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-y border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-6 py-3 font-semibold">Order</th><th className="px-6 py-3 font-semibold">Buyer</th><th className="px-6 py-3 font-semibold">Tickets</th><th className="px-6 py-3 font-semibold">Amount</th><th className="px-6 py-3 font-semibold">Status</th><th className="px-6 py-3 font-semibold">Date</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? [1,2,3].map(i => <tr key={i}><td colSpan={6} className="px-6 py-5"><div className="h-4 animate-pulse rounded bg-slate-100" /></td></tr>) : visible.length ? visible.map(order => { const related = tickets.filter(ticket => ticket.orderId === order.id); const status = related.some(ticket => ticket.status === "valid") ? "valid" : "used"; return <tr key={order.id} className="transition-colors hover:bg-slate-50/70"><td className="px-6 py-4 font-semibold text-slate-800">#{order.id.slice(-8)}</td><td className="px-6 py-4 text-slate-500">{order.buyerEmail}</td><td className="px-6 py-4 text-slate-500">{related.length || "—"}</td><td className="px-6 py-4 font-medium text-slate-800">{money(order.totalAmount)}</td><td className="px-6 py-4"><Badge className={status === "valid" ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50" : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-100"}>{status === "valid" ? "Valid" : "Used"}</Badge></td><td className="px-6 py-4 text-slate-400">{dateLabel(order.createdAt)}</td></tr>; }) : <tr><td colSpan={6}><EmptyState icon={ClipboardList} title={query ? "No matching orders" : "No orders yet"} description={query ? "Try another email or reference." : "Successful Paystack payments will appear in this table."} /></td></tr>}</tbody></table></div>{!loading && filtered.length > 0 && <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-xs text-slate-400"><span>Page {page} of {pages}</span><div className="flex gap-1"><button aria-label="Previous page" disabled={page === 1} onClick={() => setPage(Math.max(1, page - 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><button aria-label="Next page" disabled={page === pages} onClick={() => setPage(Math.min(pages, page + 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>}</CardContent></Card>;
}
function TicketTable({ tickets }: { tickets: TicketRow[] }) {
  return <Card className="border-0 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
    <CardHeader><CardTitle className="text-base">Issued tickets</CardTitle><p className="mt-1 text-sm text-slate-500">Use the ticket ID or QR code at the entrance.</p></CardHeader>
    <CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="border-y border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-6 py-3 font-semibold">Ticket ID</th><th className="px-6 py-3 font-semibold">Order</th><th className="px-6 py-3 font-semibold">Scan status</th><th className="px-6 py-3 font-semibold">Verification</th></tr></thead><tbody className="divide-y divide-slate-100">
      {tickets.map(ticket => <tr key={ticket.id}><td className="px-6 py-4 font-mono text-xs font-semibold text-slate-700">{ticket.id}</td><td className="px-6 py-4 font-mono text-xs text-slate-400">#{ticket.orderId.slice(-8)}</td><td className="px-6 py-4"><Badge className={ticket.status === "valid" ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50" : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-100"}>{ticket.status === "valid" ? "Valid" : "Used"}</Badge></td><td className="px-6 py-4 text-xs text-slate-500">{ticket.status === "used" ? "Verified at door" : "Awaiting scan"}</td></tr>)}
    </tbody></table></div></CardContent>
  </Card>;
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof Ticket; title: string; description: string }) { return <div className="flex min-h-[180px] flex-col items-center justify-center px-6 py-8 text-center"><span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-400"><Icon className="h-5 w-5" /></span><p className="font-medium text-slate-700">{title}</p><p className="mt-1 max-w-xs text-sm text-slate-400">{description}</p></div>; }
function SubPage({ path, summary, loading, error }: { path: string; summary: Summary; loading: boolean; error: string }) {
  const title = path === "/orders" ? "Orders" : path === "/tickets" ? "Tickets" : path === "/transactions" ? "Transactions" : "Settings";
  return <div className="space-y-8">
    <div><p className="mb-2 text-sm font-medium text-indigo-600">Passage workspace</p><h1 className="text-3xl font-semibold tracking-[-0.04em]">{title}</h1><p className="mt-2 text-sm text-slate-500">{title === "Settings" ? "Configure your event operations and payment connection." : "Review " + title.toLowerCase() + " with clear, operational context."}</p></div>
    {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error} Try refreshing when the database connection is available.</div>}
    {title === "Orders" && <OrdersTable orders={summary.orders} tickets={summary.tickets} loading={loading} />}
    {title === "Transactions" && <TransactionsTable />}
    {title === "Tickets" && <Card className="border-0 bg-white p-8 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">{loading ? <div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-100" />)}</div> : summary.tickets.length === 0 ? <EmptyState icon={Ticket} title="No tickets issued" description="Tickets created from successful payments will appear here." /> : <div className="grid gap-4 sm:grid-cols-3"><Metric label="All tickets" value={String(summary.tickets.length)} detail="Issued tickets" icon={Ticket} tint="violet" /><Metric label="Valid" value={String(summary.tickets.filter(t => t.status === "valid").length)} detail="Ready to scan" icon={CheckCircle2} tint="emerald" /><Metric label="Used" value={String(summary.tickets.filter(t => t.status === "used").length)} detail="Already admitted" icon={XCircle} tint="slate" /></div>}</Card>}
    {title === "Tickets" && !loading && summary.tickets.length > 0 && <TicketTable tickets={summary.tickets} />}
    {title === "Settings" && (loading ? <Card className="max-w-2xl border-0 bg-white"><CardContent className="space-y-4 p-8"><div className="h-5 w-40 animate-pulse rounded bg-slate-100" /><div className="h-4 w-full animate-pulse rounded bg-slate-100" /><div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" /></CardContent></Card> : <Card className="max-w-2xl border-0 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.06)]"><CardContent className="p-8"><div className="flex items-start gap-4"><span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Settings className="h-5 w-5" /></span><div><h2 className="font-semibold">Payment connection</h2><p className="mt-1 text-sm leading-6 text-slate-500">Add PAYSTACK_SECRET_KEY, TURSO_DATABASE_URL, and TURSO_AUTH_TOKEN in Vercel before going live. Secrets are read only on the server.</p><Badge className="mt-4 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">Configuration required</Badge></div></div></CardContent></Card>)}
  </div>;
}
