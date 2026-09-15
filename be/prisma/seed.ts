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

const databaseUrl = process.env.DATABASE_URL;
const seedAccountsJson = process.env.SEED_ACCOUNTS_JSON;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

if (!seedAccountsJson) {
  throw new Error("SEED_ACCOUNTS_JSON is required to seed accounts");
}

let seedAccounts: SeedAccount[];

try {
  seedAccounts = JSON.parse(seedAccountsJson) as SeedAccount[];
} catch {
  throw new Error("SEED_ACCOUNTS_JSON must be valid JSON");
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

  console.log(`Seeded ${seedAccounts.length} account(s)`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
