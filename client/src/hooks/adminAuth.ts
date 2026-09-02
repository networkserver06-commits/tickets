import { useCallback, useEffect, useState } from "react";

export type AdminUser = { username: string };

export function useAdminAuth() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/session?ts=${Date.now()}`, {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(response => response.json())
      .then(data => {
        if (active)
          setAdmin(data.authenticated && data.user ? data.user : null);
      })
      .catch(() => undefined)
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Unable to sign in");
    setAdmin(data.user);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/admin/logout", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    }).catch(() => undefined);
    setAdmin(null);
  }, []);

  return { admin, loading, isAuthenticated: Boolean(admin), login, logout };
}
