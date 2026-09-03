import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ChevronLeft, ChevronRight, CreditCard, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export type PaystackTransaction = {
  id: number;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  channel: string;
  paidAt: string | null;
  createdAt: string | null;
  customerEmail: string;
  customerName: string;
};

type TransactionsResponse = { transactions: PaystackTransaction[]; meta?: { page?: number; perPage?: number; total?: number; pageCount?: number } };

const money = (amount: number, currency: string) => {
  const code = currency === "KES" ? "KSh" : currency;
  return `${code} ${new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(amount / 100)}`;
};

const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString("en-KE", { timeZone: "Africa/Nairobi", dateStyle: "medium", timeStyle: "short" }) : "—";

function statusStyle(status: string) {
  if (status === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50";
  if (["failed", "abandoned"].includes(status)) return "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50";
  if (["pending", "ongoing"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50";
  return "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100";
}

export function normalizeTransactionStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, character => character.toUpperCase());
}

export default function TransactionsTable() {
  const [transactions, setTransactions] = useState<PaystackTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (nextPage: number, silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/paystack/transactions?page=${nextPage}&perPage=20`);
      const payload = await response.json() as TransactionsResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load Paystack transactions");
      setTransactions(payload.transactions || []);
      setPage(nextPage);
      setPageCount(Math.max(1, payload.meta?.pageCount || Math.ceil((payload.meta?.total || 0) / (payload.meta?.perPage || 20)) || 1));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load Paystack transactions");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(1); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(page, true), 5000);
    return () => window.clearInterval(timer);
  }, [load, page]);

  return <Card className="border-0 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
    <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><CardTitle className="text-base">Recent Paystack transactions</CardTitle><p className="mt-1 text-sm text-slate-500">Live payment activity from your Paystack account.</p></div>
      <Button variant="outline" className="w-fit gap-2 border-slate-200 bg-white" onClick={() => void load(page)} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
    </CardHeader>
    <CardContent className="p-0">
      {error && <div className="mx-6 mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-medium">Transactions unavailable</p><p className="mt-1">{error}</p></div></div>}
      <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-y border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-6 py-3 font-semibold">Reference</th><th className="px-6 py-3 font-semibold">Customer</th><th className="px-6 py-3 font-semibold">Amount</th><th className="px-6 py-3 font-semibold">Channel</th><th className="px-6 py-3 font-semibold">Status</th><th className="px-6 py-3 font-semibold">Date</th></tr></thead><tbody className="divide-y divide-slate-100">
        {loading ? [1, 2, 3, 4].map(index => <tr key={index}><td colSpan={6} className="px-6 py-5"><div className="h-4 animate-pulse rounded bg-slate-100" /></td></tr>) : transactions.length ? transactions.map(transaction => <tr key={`${transaction.id}-${transaction.reference}`} className="transition-colors hover:bg-slate-50/70"><td className="px-6 py-4"><div className="flex items-center gap-2 font-mono text-xs font-semibold text-slate-700"><span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><CreditCard className="h-3.5 w-3.5" /></span>{transaction.reference}</div></td><td className="px-6 py-4"><p className="font-medium text-slate-700">{transaction.customerName}</p><p className="mt-0.5 text-xs text-slate-400">{transaction.customerEmail}</p></td><td className="px-6 py-4 font-semibold text-slate-800">{money(transaction.amount, transaction.currency)}</td><td className="px-6 py-4 capitalize text-slate-500">{transaction.channel}</td><td className="px-6 py-4"><Badge className={statusStyle(transaction.status)}>{normalizeTransactionStatus(transaction.status)}</Badge></td><td className="px-6 py-4 text-slate-400">{dateLabel(transaction.paidAt || transaction.createdAt)}</td></tr>) : <tr><td colSpan={6}><div className="flex min-h-[190px] flex-col items-center justify-center px-6 py-8 text-center"><span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-400"><CreditCard className="h-5 w-5" /></span><p className="font-medium text-slate-700">No Paystack transactions yet</p><p className="mt-1 max-w-xs text-sm text-slate-400">Successful or pending payments will appear here when Paystack has transaction activity.</p></div></td></tr>}
      </tbody></table></div>
      {!loading && !error && transactions.length > 0 && <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-xs text-slate-400"><span>Page {page} of {pageCount}</span><div className="flex gap-1"><button aria-label="Previous transaction page" disabled={page === 1} onClick={() => void load(Math.max(1, page - 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><button aria-label="Next transaction page" disabled={page >= pageCount} onClick={() => void load(Math.min(pageCount, page + 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>}
    </CardContent>
  </Card>;
}
