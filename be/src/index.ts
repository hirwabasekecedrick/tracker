import "dotenv/config";
import express, { Request, Response } from "express";
import http from "http";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

const app = express();
const prisma = new PrismaClient();
const server = http.createServer(app);
const JWT_SECRET = process.env.JWT_SECRET || "tracker-demo-secret";
const databaseConfigured = Boolean(process.env.DATABASE_URL);
const configuredOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin: string | undefined) => !origin || configuredOrigins.includes(origin);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed"));
    },
    credentials: true,
  },
});

type AccountRole = "admin" | "driver";
type DeliveryStatus = "available" | "on_delivery" | "paused";

type LocationPoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

type UserJourneyState = {
  userId: string;
  name: string;
  email: string;
  role: AccountRole;
  vehicleNumber: string;
  phoneNumber: string;
  deliveryStatus: DeliveryStatus;
  journeyId: string | null;
  active: boolean;
  startedAt: number | null;
  updatedAt: number | null;
  lastLocation: LocationPoint | null;
  path: LocationPoint[];
};

type Account = {
  id: string;
  email: string;
  password: string;
  name: string;
  role: AccountRole;
  vehicleNumber: string;
  phoneNumber: string;
};

const accounts = new Map<string, Account>([
  ["admin@tracker.app", { id: "admin-1", email: "admin@tracker.app", password: "admin123", name: "Admin User", role: "admin", vehicleNumber: "ADMIN-01", phoneNumber: "+1 000 000 0000" }],
  ["driver@tracker.app", { id: "driver-1", email: "driver@tracker.app", password: "driver123", name: "Driver One", role: "driver", vehicleNumber: "TRK-101", phoneNumber: "+1 555 010 1010" }],
]);

const users = new Map<string, UserJourneyState>();

const getUserState = (userId: string, account: Account) => {
  const existing = users.get(userId);

  if (existing) {
    return existing;
  }

  const created: UserJourneyState = {
    userId,
    name: account.name,
    email: account.email,
    role: account.role,
    vehicleNumber: account.vehicleNumber,
    phoneNumber: account.phoneNumber,
    deliveryStatus: "available",
    journeyId: null,
    active: false,
    startedAt: null,
    updatedAt: null,
    lastLocation: null,
    path: [],
  };

  users.set(userId, created);
  return created;
};

const restorePersistedJourneys = async () => {
  if (!databaseConfigured) {
    return;
  }

  const journeys = await prisma.journey.findMany({
    orderBy: { startedAt: "desc" },
    include: { points: { orderBy: { timestamp: "asc" } } },
  });
  const restoredUsers = new Set<string>();

  for (const journey of journeys) {
    if (restoredUsers.has(journey.userId)) {
      continue;
    }

    const account = [...accounts.values()].find((entry) => entry.id === journey.userId);
    if (!account) {
      continue;
    }

    const record = getUserState(journey.userId, account);
    record.journeyId = journey.id;
    record.name = journey.name;
    record.vehicleNumber = journey.vehicleNumber;
    record.active = journey.active;
    record.deliveryStatus = journey.active ? "on_delivery" : "available";
    record.startedAt = journey.startedAt.getTime();
    record.path = journey.points.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      timestamp: point.timestamp.getTime(),
    }));
    record.lastLocation = record.path.at(-1) || null;
    record.updatedAt = record.lastLocation?.timestamp || record.startedAt;
    restoredUsers.add(journey.userId);
  }
};

const createPersistedJourney = async (record: UserJourneyState) => {
  if (!databaseConfigured) {
    return;
  }

  const journey = await prisma.journey.create({
    data: {
      userId: record.userId,
      name: record.name,
      vehicleNumber: record.vehicleNumber,
      startedAt: new Date(record.startedAt || Date.now()),
    },
  });
  record.journeyId = journey.id;
};

const persistLocationPoint = async (record: UserJourneyState, point: LocationPoint) => {
  if (!databaseConfigured || !record.journeyId) {
    return;
  }

  await prisma.locationPoint.create({
    data: {
      journeyId: record.journeyId,
      latitude: point.latitude,
      longitude: point.longitude,
      timestamp: new Date(point.timestamp),
    },
  });
};

const finishPersistedJourney = async (record: UserJourneyState) => {
  if (!databaseConfigured || !record.journeyId) {
    return;
  }

  await prisma.journey.update({
    where: { id: record.journeyId },
    data: { active: false, endedAt: new Date(record.updatedAt || Date.now()) },
  });
};

const emitUsersUpdate = () => {
  io.to("admins").emit("usersUpdate", Array.from(users.values()));
};

const getBearerToken = (req: Request) => {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
};

const getAuthenticatedUser = (req: Request) => {
  const token = getBearerToken(req);
  return token ? verifyToken(token) : null;
};

const isValidLocationUpdate = (
  payload: unknown
): payload is LocationPoint & { userId: string; name?: string; vehicleNumber?: string; phoneNumber?: string } => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const { userId, name, vehicleNumber, phoneNumber, latitude, longitude, timestamp } = payload as Record<string, unknown>;

  return (
    typeof userId === "string" &&
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    typeof timestamp === "number" &&
    (typeof name === "string" || typeof name === "undefined") &&
    (typeof vehicleNumber === "string" || typeof vehicleNumber === "undefined") &&
    (typeof phoneNumber === "string" || typeof phoneNumber === "undefined")
  );
};

const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: AccountRole };
  } catch {
    return null;
  }
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Tracker API", status: "ok" });
});

app.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", database: "disconnected" });
  }
});

app.post("/api/auth/login", (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ message: "Email and password are required" });
    return;
  }

  const account = accounts.get(email.toLowerCase());

  if (!account || account.password !== password) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const token = jwt.sign({ userId: account.id, email: account.email, role: account.role }, JWT_SECRET, { expiresIn: "7d" });

  const safeUser = {
    id: account.id,
    email: account.email,
    name: account.name,
    role: account.role,
    vehicleNumber: account.vehicleNumber,
    phoneNumber: account.phoneNumber,
  };

  res.json({ token, user: safeUser });
});

app.get("/api/journey/users", (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);

  if (!user || user.role !== "admin") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }

  res.json(Array.from(users.values()));
});

app.post("/api/journey/start", (req: Request, res: Response) => {
  const authenticatedUser = getAuthenticatedUser(req);
  const { userId, name, vehicleNumber, phoneNumber } = req.body as {
    userId?: string;
    name?: string;
    vehicleNumber?: string;
    phoneNumber?: string;
  };

  if (!authenticatedUser || authenticatedUser.role !== "driver" || authenticatedUser.userId !== userId) {
    res.status(403).json({ message: "Only riders can start their own journey" });
    return;
  }

  if (!userId || typeof userId !== "string") {
    res.status(400).json({ message: "userId is required" });
    return;
  }

  const account = [...accounts.values()].find((entry) => entry.id === userId);

  if (!account) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const record = getUserState(userId, account);
  record.name = name || account.name || "User";
  record.vehicleNumber = vehicleNumber || account.vehicleNumber || "Vehicle 01";
  record.phoneNumber = phoneNumber || account.phoneNumber || "N/A";
  record.deliveryStatus = "on_delivery";
  record.active = true;
  record.startedAt = Date.now();
  record.updatedAt = Date.now();

  void createPersistedJourney(record).then(emitUsersUpdate).catch(console.error);
  res.json({ ok: true, user: record });
});

app.post("/api/journey/stop", (req: Request, res: Response) => {
  const authenticatedUser = getAuthenticatedUser(req);
  const { userId } = req.body as { userId?: string };

  if (!authenticatedUser || authenticatedUser.role !== "driver" || authenticatedUser.userId !== userId) {
    res.status(403).json({ message: "Only riders can stop their own journey" });
    return;
  }

  if (!userId || typeof userId !== "string") {
    res.status(400).json({ message: "userId is required" });
    return;
  }

  const account = [...accounts.values()].find((entry) => entry.id === userId);

  if (!account) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const record = getUserState(userId, account);
  record.active = false;
  record.deliveryStatus = "available";
  record.updatedAt = Date.now();

  void finishPersistedJourney(record).then(emitUsersUpdate).catch(console.error);
  res.json({ ok: true, user: record });
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token as string | undefined;

  if (!token) {
    next(new Error("Authentication required"));
    return;
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    next(new Error("Invalid token"));
    return;
  }

  socket.data.user = decoded;
  next();
});

io.on("connection", (socket) => {
  const user = socket.data.user as { userId: string; email: string; role: AccountRole } | undefined;
  console.log("Client connected", socket.id, user?.email);

  if (user?.role === "admin") {
    socket.join("admins");
    socket.emit("usersUpdate", Array.from(users.values()));
  } else if (user) {
    const account = accounts.get(user.email);
    if (account) {
      socket.emit("usersUpdate", [getUserState(user.userId, account)]);
    }
  }

  socket.on("journey:start", async (payload: unknown) => {
    if (user?.role !== "driver") {
      socket.emit("error", { message: "Only riders can start journeys" });
      return;
    }

    if (!payload || typeof payload !== "object") {
      socket.emit("error", { message: "Invalid journey start payload" });
      return;
    }

    const account = [...accounts.values()].find((entry) => entry.id === user?.userId);

    if (!account) {
      socket.emit("error", { message: "User not found" });
      return;
    }

    const { name, vehicleNumber, phoneNumber } = payload as {
      name?: string;
      vehicleNumber?: string;
      phoneNumber?: string;
    };

    const record = getUserState(account.id, account);
    record.name = name || account.name || "User";
    record.vehicleNumber = vehicleNumber || account.vehicleNumber || "Vehicle 01";
    record.phoneNumber = phoneNumber || account.phoneNumber || "N/A";
    record.deliveryStatus = "on_delivery";
    record.active = true;
    record.startedAt = Date.now();
    record.updatedAt = Date.now();

    try {
      await createPersistedJourney(record);
      emitUsersUpdate();
    } catch (error) {
      console.error("Unable to persist journey start", error);
      socket.emit("error", { message: "Unable to start journey" });
    }
  });

  socket.on("journey:stop", async () => {
    if (user?.role !== "driver") {
      socket.emit("error", { message: "Only riders can stop journeys" });
      return;
    }

    const account = [...accounts.values()].find((entry) => entry.id === user?.userId);

    if (!account) {
      socket.emit("error", { message: "User not found" });
      return;
    }

    const record = getUserState(account.id, account);
    record.active = false;
    record.deliveryStatus = "available";
    record.updatedAt = Date.now();

    try {
      await finishPersistedJourney(record);
      emitUsersUpdate();
    } catch (error) {
      console.error("Unable to persist journey stop", error);
      socket.emit("error", { message: "Unable to stop journey" });
    }
  });

  socket.on("locationUpdate", async (payload: unknown) => {
    if (!user || user.role !== "driver") {
      socket.emit("error", { message: "Authentication required" });
      return;
    }

    if (!isValidLocationUpdate(payload)) {
      socket.emit("error", { message: "Invalid location payload" });
      return;
    }

    const account = [...accounts.values()].find((entry) => entry.id === user.userId);

    if (!account) {
      socket.emit("error", { message: "User not found" });
      return;
    }

    const { name, vehicleNumber, phoneNumber, latitude, longitude, timestamp } = payload;
    const record = getUserState(account.id, account);

    record.name = name || account.name || "User";
    record.vehicleNumber = vehicleNumber || account.vehicleNumber || "Vehicle 01";
    record.phoneNumber = phoneNumber || account.phoneNumber || "N/A";
    record.updatedAt = timestamp;
    record.lastLocation = { latitude, longitude, timestamp };

    if (record.active) {
      const point = { latitude, longitude, timestamp };
      record.path.push(point);

      try {
        await persistLocationPoint(record, point);
      } catch (error) {
        console.error("Unable to persist location point", error);
      }
    }

    emitUsersUpdate();
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected", socket.id);
  });
});

const PORT = Number(process.env.PORT) || 4000;

void restorePersistedJourneys()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Unable to restore persisted journeys", error);
    process.exitCode = 1;
  });