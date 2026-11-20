import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

const state = globalThis as unknown as { studioDb?: PrismaClient };
const adapter = () =>
  new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
  });
export const db = state.studioDb ?? new PrismaClient({ adapter: adapter() });
if (process.env.NODE_ENV !== "production") state.studioDb = db;
