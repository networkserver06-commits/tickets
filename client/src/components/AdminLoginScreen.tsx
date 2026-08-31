import { useState } from "react";
import { Ticket, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminLoginScreen({ loading = false, onLogin, heading = "Your event, in control.", description = "Sign in to review orders, manage tickets, and verify guests at the door." }: { loading?: boolean; onLogin: (username: string, password: string) => Promise<void>; heading?: string; description?: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await onLogin(username, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="grid min-h-screen place-items-center bg-slate-950 px-5"><div className="w-full max-w-sm text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-600/20"><Ticket className="h-7 w-7" /></span><p className="mt-7 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Passage admin</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{heading}</h1><p className="mt-3 leading-6 text-slate-400">{description}</p>{loading ? <div className="mx-auto mt-8 h-12 w-full animate-pulse rounded-xl bg-white/10" /> : <form onSubmit={submit} className="mt-8 space-y-3 text-left"><label className="block text-sm font-medium text-slate-200">Username<input required autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-white outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/10" /></label><label className="block text-sm font-medium text-slate-200">Password<input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-white outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/10" /></label>{error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p>}<Button type="submit" disabled={submitting} className="h-12 w-full rounded-xl bg-white text-slate-950 hover:bg-slate-100">{submitting ? "Signing in…" : "Sign in to continue"} {!submitting && <TrendingUp className="ml-2 h-4 w-4" />}</Button></form>}<p className="mt-6 text-xs text-slate-600">Admin access is protected by a secure server session.</p></div></div>;
}
