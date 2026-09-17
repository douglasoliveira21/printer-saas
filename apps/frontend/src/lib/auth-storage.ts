// Access + refresh tokens live in localStorage for this MVP. Fine for an
// internal B2B admin tool; revisit (httpOnly cookies issued by the API) once
// the customer portal (spec §34) exposes this to end-customer users too.
const ACCESS_TOKEN_KEY = "printer_saas_access_token";
const REFRESH_TOKEN_KEY = "printer_saas_refresh_token";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  tenantId: string;
  isSuperAdmin: boolean;
  customerId: string | null;
}

const USER_KEY = "printer_saas_user";

export const authStorage = {
  getAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  getUser(): StoredUser | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  },
  setSession(accessToken: string, refreshToken: string, user: StoredUser) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  setAccessToken(accessToken: string) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};
