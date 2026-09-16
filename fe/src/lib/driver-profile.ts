import { useCallback, useState } from "react";
import type { AppUser } from "@/lib/auth";

export type DriverProfile = {
  name: string;
  vehicleNumber: string;
  phoneNumber: string;
};

const getStorageKey = (userId: string) => `tracker-driver-profile-${userId}`;

const readStoredProfile = (user: AppUser): DriverProfile => {
  if (typeof window === "undefined") {
    return { name: user.name, vehicleNumber: user.vehicleNumber, phoneNumber: user.phoneNumber };
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(user.id));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DriverProfile>;
      return {
        name: typeof parsed.name === "string" && parsed.name ? parsed.name : user.name,
        vehicleNumber:
          typeof parsed.vehicleNumber === "string" && parsed.vehicleNumber ? parsed.vehicleNumber : user.vehicleNumber,
        phoneNumber:
          typeof parsed.phoneNumber === "string" && parsed.phoneNumber ? parsed.phoneNumber : user.phoneNumber,
      };
    }
  } catch {
    // Ignore malformed storage.
  }

  return { name: user.name, vehicleNumber: user.vehicleNumber, phoneNumber: user.phoneNumber };
};

export function useDriverProfile(user: AppUser) {
  const [profile, setProfile] = useState<DriverProfile>(() => readStoredProfile(user));

  const [activeUserId, setActiveUserId] = useState(user.id);
  if (activeUserId !== user.id) {
    setActiveUserId(user.id);
    setProfile(readStoredProfile(user));
  }

  const updateProfile = useCallback(
    (next: DriverProfile) => {
      setProfile(next);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(getStorageKey(user.id), JSON.stringify(next));
        } catch (error) {
          console.error("Unable to save driver profile", error);
        }
      }
    },
    [user.id]
  );

  return { profile, updateProfile };
}