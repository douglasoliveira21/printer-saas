// Access + refresh tokens live in localStorage or sessionStorage for this
// MVP, chosen at login time by "Lembrar de mim" (localStorage = persists
// across browser restarts, sessionStorage = cleared when the tab/browser
// closes). Fine for an internal B2B admin tool; revisit (httpOnly cookies
// issued by the API) once the customer portal (spec §34) exposes this to
// end-customer users too.
const ACCESS_TOKEN_KEY = "printer_saas_access_token";
const REFRESH_TOKEN_KEY = "printer_saas_refresh_token";
const USER_KEY = "printer_saas_user";
const REMEMBER_KEY = "printer_saas_remember";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  tenantId: string;
  isSuperAdmin: boolean;
  customerId: string | null;
}

function activeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REMEMBER_KEY) === "1" ? localStorage : sessionStorage;
}

export const authStorage = {
  getAccessToken(): string | null {
    return activeStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
  },
  getRefreshToken(): string | null {
    return activeStorage()?.getItem(REFRESH_TOKEN_KEY) ?? null;
  },
  getUser(): StoredUser | null {
    const raw = activeStorage()?.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  },
  setSession(accessToken: string, refreshToken: string, user: StoredUser, remember = true) {
    if (typeof window === "undefined") return;
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(ACCESS_TOKEN_KEY, accessToken);
    storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    storage.setItem(USER_KEY, JSON.stringify(user));
  },
  setAccessToken(accessToken: string) {
    activeStorage()?.setItem(ACCESS_TOKEN_KEY, accessToken);
  },
  setUser(user: StoredUser) {
    activeStorage()?.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    if (typeof window === "undefined") return;
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem(ACCESS_TOKEN_KEY);
      storage.removeItem(REFRESH_TOKEN_KEY);
      storage.removeItem(USER_KEY);
    }
    localStorage.removeItem(REMEMBER_KEY);
  },
};
