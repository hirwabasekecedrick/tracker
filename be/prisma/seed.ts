import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

type SeedAccount = {
  id: string;
  email: string;
  password: string;
  name: string;
  role: "admin" | "driver";
  vehicleNumber: string;
  phoneNumber: string;
};

type SeedJourney = {
  id: string;
  userId: string;
  name: string;
  vehicleNumber: string;
  startedAt: string;
  endedAt: string;
  active: boolean;
  points: Array<{
    latitude: number;
    longitude: number;
    timestamp: string;
  }>;
};

const databaseUrl = process.env.DATABASE_URL;
const seedAccountsJson = process.env.SEED_ACCOUNTS_JSON;
const seedJourneysJson = process.env.SEED_JOURNEYS_JSON;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

if (!seedAccountsJson) {
  throw new Error("SEED_ACCOUNTS_JSON is required to seed accounts");
}

let seedAccounts: SeedAccount[];
let seedJourneys: SeedJourney[] = [];

try {
  seedAccounts = JSON.parse(seedAccountsJson) as SeedAccount[];
} catch {
  throw new Error("SEED_ACCOUNTS_JSON must be valid JSON");
}

if (seedJourneysJson) {
  try {
    seedJourneys = JSON.parse(seedJourneysJson) as SeedJourney[];
  } catch {
    throw new Error("SEED_JOURNEYS_JSON must be valid JSON");
  }
}

const prisma = new PrismaClient();

const main = async () => {
  for (const account of seedAccounts) {
    const passwordHash = await hash(account.password, 12);

    await prisma.account.upsert({
      where: { email: account.email.toLowerCase() },
      update: {
        name: account.name,
        role: account.role,
        vehicleNumber: account.vehicleNumber,
        phoneNumber: account.phoneNumber,
        passwordHash,
      },
      create: {
        id: account.id,
        email: account.email.toLowerCase(),
        name: account.name,
        role: account.role,
        vehicleNumber: account.vehicleNumber,
        phoneNumber: account.phoneNumber,
        passwordHash,
      },
    });
  }

  for (const journey of seedJourneys) {
    await prisma.journey.upsert({
      where: { id: journey.id },
      update: {
        userId: journey.userId,
        name: journey.name,
        vehicleNumber: journey.vehicleNumber,
        startedAt: new Date(journey.startedAt),
        endedAt: new Date(journey.endedAt),
        active: journey.active,
        points: {
          deleteMany: {},
          create: journey.points.map((point) => ({
            latitude: point.latitude,
            longitude: point.longitude,
            timestamp: new Date(point.timestamp),
          })),
        },
      },
      create: {
        id: journey.id,
        userId: journey.userId,
        name: journey.name,
        vehicleNumber: journey.vehicleNumber,
        startedAt: new Date(journey.startedAt),
        endedAt: new Date(journey.endedAt),
        active: journey.active,
        points: {
          create: journey.points.map((point) => ({
            latitude: point.latitude,
            longitude: point.longitude,
            timestamp: new Date(point.timestamp),
          })),
        },
      },
    });
  }

  console.log(`Seeded ${seedAccounts.length} account(s) and ${seedJourneys.length} journey(s)`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
