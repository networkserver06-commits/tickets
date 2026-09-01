import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BarChart3, ChevronRight, ClipboardList, CreditCard, Menu, Settings, Ticket, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

const items = [
  { label: "Overview", href: "/admin", icon: BarChart3 },
  { label: "Orders", href: "/admin/orders", icon: ClipboardList },
  { label: "Tickets", href: "/admin/tickets", icon: Ticket },
  { label: "Transactions", href: "/admin/transactions", icon: CreditCard },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-slate-950">
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur md:hidden">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm"><Ticket className="h-4 w-4" /></span>
          <span className="font-semibold tracking-tight">Passage</span>
        </Link>
        <Button variant="ghost" size="icon" aria-label="Toggle menu" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</Button>
      </header>

      {open && <button className="fixed inset-0 z-40 bg-slate-950/20 md:hidden" aria-label="Close menu" onClick={() => setOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[260px] -translate-x-full flex-col border-r border-slate-200/80 bg-white px-4 py-5 transition-transform md:translate-x-0", open && "translate-x-0")}>
        <div className="flex items-center justify-between px-2 pb-8">
          <Link href="/admin" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"><Ticket className="h-5 w-5" /></span>
            <div><p className="font-semibold tracking-tight">Passage</p><p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">Ticketing OS</p></div>
          </Link>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
        </div>
        <p className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
        <nav className="space-y-1">
          {items.map(({ label, href, icon: Icon }) => {
            const active = location === href;
            return <Link key={label} href={href} onClick={() => setOpen(false)} className={cn("group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900")}><Icon className={cn("h-[18px] w-[18px]", active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-700")} /><span>{label}</span>{active && <ChevronRight className="ml-auto h-4 w-4" />}</Link>;
          })}
        </nav>
        <div className="mt-auto rounded-2xl bg-slate-950 p-4 text-white shadow-xl shadow-slate-950/10">
          <p className="text-xs font-medium text-slate-400">Your workspace</p><p className="mt-1 truncate text-sm font-semibold">{user?.name || "Event operations"}</p><p className="mt-3 text-xs leading-5 text-slate-400">Keep every entrance moving with confidence.</p>
          {user && <button onClick={logout} className="mt-3 text-xs font-semibold text-indigo-300 hover:text-white">Sign out</button>}
        </div>
      </aside>
      <main className="min-h-screen pt-16 md:pl-[260px] md:pt-0"><div className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-10">{children}</div></main>
    </div>
  );
}
