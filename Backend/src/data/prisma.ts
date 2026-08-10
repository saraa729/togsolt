'use strict';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

let prisma: PrismaClient | null = null;

function databaseUrl() {
  return process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/expocraft';
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: databaseUrl() });
  return new PrismaClient({ adapter });
}

function getPrismaClient() {
  if (!prisma) prisma = createPrismaClient();
  return prisma;
}

async function disconnectPrisma() {
  if (!prisma) return;
  await prisma.$disconnect();
  prisma = null;
}

module.exports = { getPrismaClient, disconnectPrisma, databaseUrl };
