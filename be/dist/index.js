"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const client_1 = require("@prisma/client");
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = require("bcryptjs");
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const server = http_1.default.createServer(app);
const JWT_SECRET = process.env.JWT_SECRET;
const configuredOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const PORT = Number(process.env.PORT);
const SERVER_PUBLIC_URL = process.env.SERVER_PUBLIC_URL;
const databaseConfigured = Boolean(process.env.DATABASE_URL);
if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
}
if (!configuredOrigins.length) {
    throw new Error("CORS_ORIGINS is required");
}
if (!Number.isInteger(PORT) || PORT < 1) {
    throw new Error("PORT must be a valid port number");
}
if (!SERVER_PUBLIC_URL) {
    throw new Error("SERVER_PUBLIC_URL is required");
}
const isAllowedOrigin = (origin) => !origin || configuredOrigins.includes(origin);
const io = new socket_io_1.Server(server, {
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
const accounts = new Map();
const getAccountById = (userId) => [...accounts.values()].find((account) => account.id === userId);
const loadAccounts = async () => {
    if (!databaseConfigured) {
        throw new Error("DATABASE_URL is required to load accounts");
    }
    const storedAccounts = await prisma.account.findMany();
    accounts.clear();
    for (const account of storedAccounts) {
        accounts.set(account.email.toLowerCase(), {
            id: account.id,
            email: account.email,
            passwordHash: account.passwordHash,
            name: account.name,
            role: account.role,
            vehicleNumber: account.vehicleNumber,
            phoneNumber: account.phoneNumber,
        });
    }
};
const users = new Map();
const getUserState = (userId, account) => {
    const existing = users.get(userId);
    if (existing) {
        return existing;
    }
    const created = {
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
    const restoredUsers = new Set();
    for (const journey of journeys) {
        if (restoredUsers.has(journey.userId)) {
            continue;
        }
        const account = getAccountById(journey.userId);
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
const createPersistedJourney = async (record) => {
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
const persistLocationPoint = async (record, point) => {
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
const finishPersistedJourney = async (record) => {
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
const getBearerToken = (req) => {
    const header = req.headers.authorization;
    return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
};
const getAuthenticatedUser = (req) => {
    const token = getBearerToken(req);
    return token ? verifyToken(token) : null;
};
const isValidLocationUpdate = (payload) => {
    if (!payload || typeof payload !== "object") {
        return false;
    }
    const { userId, name, vehicleNumber, phoneNumber, latitude, longitude, timestamp } = payload;
    return (typeof userId === "string" &&
        typeof latitude === "number" &&
        typeof longitude === "number" &&
        typeof timestamp === "number" &&
        (typeof name === "string" || typeof name === "undefined") &&
        (typeof vehicleNumber === "string" || typeof vehicleNumber === "undefined") &&
        (typeof phoneNumber === "string" || typeof phoneNumber === "undefined"));
};
const verifyToken = (token) => {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch {
        return null;
    }
};
app.use((0, cors_1.default)({
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
}));
app.use(express_1.default.json());
app.get("/", (_req, res) => {
    res.json({ message: "Tracker API", status: "ok" });
});
app.get("/health", async (_req, res) => {
    try {
        await prisma.$queryRaw `SELECT 1`;
        res.json({ status: "ok", database: "connected" });
    }
    catch (err) {
        res.status(500).json({ status: "error", database: "disconnected" });
    }
});
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ message: "Email and password are required" });
        return;
    }
    const account = accounts.get(email.toLowerCase());
    if (!account || !(await (0, bcryptjs_1.compare)(password, account.passwordHash))) {
        res.status(401).json({ message: "Invalid credentials" });
        return;
    }
    const token = jsonwebtoken_1.default.sign({ userId: account.id, email: account.email, role: account.role }, JWT_SECRET, { expiresIn: "7d" });
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
app.get("/api/journey/users", (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== "admin") {
        res.status(403).json({ message: "Admin access required" });
        return;
    }
    res.json(Array.from(users.values()));
});
app.post("/api/journey/start", (req, res) => {
    const authenticatedUser = getAuthenticatedUser(req);
    const { userId, name, vehicleNumber, phoneNumber } = req.body;
    if (!authenticatedUser || authenticatedUser.role !== "driver" || authenticatedUser.userId !== userId) {
        res.status(403).json({ message: "Only riders can start their own journey" });
        return;
    }
    if (!userId || typeof userId !== "string") {
        res.status(400).json({ message: "userId is required" });
        return;
    }
    const account = getAccountById(userId);
    if (!account) {
        res.status(404).json({ message: "User not found" });
        return;
    }
    const record = getUserState(userId, account);
    record.name = name || account.name || "User";
    record.vehicleNumber = vehicleNumber || account.vehicleNumber;
    record.phoneNumber = phoneNumber || account.phoneNumber || "N/A";
    record.deliveryStatus = "on_delivery";
    record.active = true;
    record.startedAt = Date.now();
    record.updatedAt = Date.now();
    void createPersistedJourney(record).then(emitUsersUpdate).catch(console.error);
    res.json({ ok: true, user: record });
});
app.post("/api/journey/stop", (req, res) => {
    const authenticatedUser = getAuthenticatedUser(req);
    const { userId } = req.body;
    if (!authenticatedUser || authenticatedUser.role !== "driver" || authenticatedUser.userId !== userId) {
        res.status(403).json({ message: "Only riders can stop their own journey" });
        return;
    }
    if (!userId || typeof userId !== "string") {
        res.status(400).json({ message: "userId is required" });
        return;
    }
    const account = getAccountById(userId);
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
    const token = socket.handshake.auth.token;
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
    const user = socket.data.user;
    console.log("Client connected", socket.id, user?.email);
    if (user?.role === "admin") {
        socket.join("admins");
        socket.emit("usersUpdate", Array.from(users.values()));
    }
    else if (user) {
        const account = accounts.get(user.email);
        if (account) {
            socket.emit("usersUpdate", [getUserState(user.userId, account)]);
        }
    }
    socket.on("journey:start", async (payload, acknowledge) => {
        if (user?.role !== "driver") {
            socket.emit("error", { message: "Only riders can start journeys" });
            acknowledge?.({ ok: false });
            return;
        }
        if (!payload || typeof payload !== "object") {
            socket.emit("error", { message: "Invalid journey start payload" });
            return;
        }
        const account = user ? getAccountById(user.userId) : undefined;
        if (!account) {
            socket.emit("error", { message: "User not found" });
            return;
        }
        const { name, vehicleNumber, phoneNumber } = payload;
        const record = getUserState(account.id, account);
        record.name = name || account.name || "User";
        record.vehicleNumber = vehicleNumber || account.vehicleNumber;
        record.phoneNumber = phoneNumber || account.phoneNumber || "N/A";
        record.deliveryStatus = "on_delivery";
        record.active = true;
        record.startedAt = Date.now();
        record.updatedAt = Date.now();
        try {
            await createPersistedJourney(record);
            emitUsersUpdate();
            acknowledge?.({ ok: true });
        }
        catch (error) {
            console.error("Unable to persist journey start", error);
            socket.emit("error", { message: "Unable to start journey" });
            acknowledge?.({ ok: false });
        }
    });
    socket.on("journey:stop", async (_payload, acknowledge) => {
        if (user?.role !== "driver") {
            socket.emit("error", { message: "Only riders can stop journeys" });
            acknowledge?.({ ok: false });
            return;
        }
        const account = user ? getAccountById(user.userId) : undefined;
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
            acknowledge?.({ ok: true });
        }
        catch (error) {
            console.error("Unable to persist journey stop", error);
            socket.emit("error", { message: "Unable to stop journey" });
            acknowledge?.({ ok: false });
        }
    });
    socket.on("locationUpdate", async (payload, acknowledge) => {
        const acknowledgeFailure = () => acknowledge?.({ ok: false });
        if (!user || user.role !== "driver") {
            socket.emit("error", { message: "Authentication required" });
            acknowledgeFailure();
            return;
        }
        if (!isValidLocationUpdate(payload)) {
            socket.emit("error", { message: "Invalid location payload" });
            acknowledgeFailure();
            return;
        }
        const account = getAccountById(user.userId);
        if (!account) {
            socket.emit("error", { message: "User not found" });
            acknowledgeFailure();
            return;
        }
        const { name, vehicleNumber, phoneNumber, latitude, longitude, timestamp } = payload;
        const record = getUserState(account.id, account);
        record.name = name || account.name || "User";
        record.vehicleNumber = vehicleNumber || account.vehicleNumber;
        record.phoneNumber = phoneNumber || account.phoneNumber || "N/A";
        record.updatedAt = timestamp;
        record.lastLocation = { latitude, longitude, timestamp };
        if (record.active) {
            const point = { latitude, longitude, timestamp };
            record.path.push(point);
            try {
                await persistLocationPoint(record, point);
            }
            catch (error) {
                console.error("Unable to persist location point", error);
                acknowledgeFailure();
                return;
            }
        }
        emitUsersUpdate();
        acknowledge?.({ ok: true });
    });
    socket.on("disconnect", () => {
        console.log("Client disconnected", socket.id);
    });
});
void loadAccounts()
    .then(restorePersistedJourneys)
    .then(() => {
    server.listen(PORT, () => {
        console.log(`Server running on ${SERVER_PUBLIC_URL}`);
    });
})
    .catch((error) => {
    console.error("Unable to restore persisted journeys", error);
    process.exitCode = 1;
});
//# sourceMappingURL=index.js.map