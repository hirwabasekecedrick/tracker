export type LocationPoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

export type DeliveryStatus = "available" | "on_delivery" | "paused";

export type UserJourneyState = {
  userId: string;
  name: string;
  vehicleNumber: string;
  phoneNumber: string;
  deliveryStatus: DeliveryStatus;
  active: boolean;
  startedAt: number | null;
  updatedAt: number | null;
  lastLocation: LocationPoint | null;
  path: LocationPoint[];
};
