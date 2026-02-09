import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import type { Role, User } from "../types";

const TOKEN_KEY = "attendance_token";

type LoginPayload = { email: string; password: string };

type SignupPayload = { name: string; email: string; password: string; role: Role; inviteCode?: string };

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const data = await apiRequest<{ user: User }>("/me", { token: stored });
        setUser(data.user);
        setToken(stored);
      } catch (err) {
        window.localStorage.removeItem(TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const login = async (payload: LoginPayload) => {
    const data = await apiRequest<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: payload
    });
    setUser(data.user);
    setToken(data.token);
    window.localStorage.setItem(TOKEN_KEY, data.token);
  };

  const signup = async (payload: SignupPayload) => {
    const data = await apiRequest<{ token: string; user: User }>("/auth/signup", {
      method: "POST",
      body: payload
    });
    setUser(data.user);
    setToken(data.token);
    window.localStorage.setItem(TOKEN_KEY, data.token);
  };

  const logout = async () => {
    if (token) {
      try {
        await apiRequest("/auth/logout", { method: "POST", token });
      } catch (err) {
        // ignore
      }
    }
    setUser(null);
    setToken(null);
    window.localStorage.removeItem(TOKEN_KEY);
  };

  return { user, token, loading, login, signup, logout };
}
