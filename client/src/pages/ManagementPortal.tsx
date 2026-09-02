import ClientPayouts from "./ClientPayouts";
import AdminLoginScreen from "@/components/AdminLoginScreen";
import { useAdminAuth } from "@/hooks/adminAuth";
import EventManagement from "./EventManagement";

export default function ManagementPortal() {
  const { loading, isAuthenticated, login } = useAdminAuth();
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f6f7fb] text-slate-500">Checking admin session…</div>;
  if (!isAuthenticated) return <AdminLoginScreen loading={loading} onLogin={login} heading="Manage Passage tenants." description="Sign in to configure client payouts and publish live event storefronts." />;
  return <main className="min-h-screen bg-[#f6f7fb] px-5 py-8 text-slate-950 sm:px-8"><div className="mx-auto max-w-6xl"><header className="mb-8 rounded-3xl bg-slate-950 p-8 text-white"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Passage operations</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Management portal</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Manage tenant payout profiles, create live events, and share event-specific checkout links.</p></header><div className="grid gap-8 lg:grid-cols-2"><ClientPayouts /><EventManagement /></div></div></main>;
}
