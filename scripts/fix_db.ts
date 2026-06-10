import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

async function fixDb() {
  const db = await getDb();
  if (!db) {
    console.error("No DB connection");
    process.exit(1);
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "reports" (
        "id" serial PRIMARY KEY NOT NULL,
        "reporterId" integer NOT NULL,
        "targetType" varchar(20) NOT NULL,
        "targetId" integer NOT NULL,
        "reason" text NOT NULL,
        "status" varchar(20) DEFAULT 'pending' NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log("Created reports table");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "blocks" (
        "id" serial PRIMARY KEY NOT NULL,
        "blockerId" integer NOT NULL,
        "blockedId" integer NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL
      );
    `);
    
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "unique_block" ON "blocks" ("blockerId", "blockedId");
    `);
    console.log("Created blocks table");

    process.exit(0);
  } catch (err) {
    console.error("DB Fix Error:", err);
    process.exit(1);
  }
}

fixDb();
