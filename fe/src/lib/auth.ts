export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "driver";
  vehicleNumber: string;
  phoneNumber: string;
};

const STORAGE_KEY = "tracker-auth";

export const authStorage = {
  save(user: AppUser, token: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }));
  },

  get() {
    if (typeof window === "undefined") return null;
    const item = window.localStorage.getItem(STORAGE_KEY);
    if (!item) return null;

    try {
      return JSON.parse(item) as { user: AppUser; token: string };
    } catch {
      return null;
    }
  },

  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
  },
};
