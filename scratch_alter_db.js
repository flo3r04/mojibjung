import postgres from "postgres";
import { config } from "dotenv";

config();

async function main() {
  const sql = postgres(process.env.DATABASE_URL);
  try {
    // 1. Create table groups
    await sql`
      CREATE TABLE IF NOT EXISTS "groups" (
        "id" serial PRIMARY KEY,
        "name" varchar(100) NOT NULL,
        "leaderId" integer NOT NULL,
        "accessKey" varchar(64) NOT NULL UNIQUE,
        "createdAt" timestamp DEFAULT now() NOT NULL
      );
    `;
    console.log("Table 'groups' created/verified successfully.");

    // 2. Create table group_members
    await sql`
      CREATE TABLE IF NOT EXISTS "group_members" (
        "id" serial PRIMARY KEY,
        "userId" integer NOT NULL,
        "groupId" integer NOT NULL,
        "joinedAt" timestamp DEFAULT now() NOT NULL
      );
    `;
    console.log("Table 'group_members' created/verified successfully.");

    // 3. Add column groupId to calendar_events
    await sql`
      ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "groupId" integer;
    `;
    console.log("Column 'groupId' added/verified in 'calendar_events'.");

    // 4. Add column groupId to posts
    await sql`
      ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "groupId" integer;
    `;
    console.log("Column 'groupId' added/verified in 'posts'.");

  } catch (err) {
    console.error("Migration error:", err);
  }
  process.exit(0);
}

main();
