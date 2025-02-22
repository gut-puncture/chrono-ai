// lib/prisma.js
import { PrismaClient } from '@prisma/client';

let prisma;

if (process.env.NODE_ENV === 'production') {
  try {
    prisma = new PrismaClient();
  } catch (error) {
    console.error("Error creating PrismaClient in production:", error);
    throw error; // Re-throw to halt execution
  }
} else {
  // Ensure the PrismaClient is re-instantiated during hot-reloading
  // in development *BUT* only if it doesn't exist. This prevents
  // multiple PrismaClient instances.
  if (!globalThis.prisma) {
    try {
      globalThis.prisma = new PrismaClient();
    } catch (error) {
      console.error("Error creating PrismaClient in development:", error);
      throw error; // Re-throw to halt execution
    }
  }
  prisma = globalThis.prisma;
}

export default prisma;
