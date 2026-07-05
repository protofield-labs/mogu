/**
 * CLI entry for demo seed (#46).
 * Run via: pnpm db:seed
 */
import { PrismaClient } from "@prisma/client";

import { seedDemo } from "../src/lib/seed/run-demo-seed";

const prisma = new PrismaClient();

seedDemo(prisma)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
