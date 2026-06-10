import postgres from "postgres";
import { config } from "dotenv";

config();

async function main() {
  const sql = postgres(process.env.DATABASE_URL);
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS "calendar_events" (
        "id" serial PRIMARY KEY,
        "userId" integer,
        "title" varchar(200) NOT NULL,
        "description" text,
        "startDate" timestamp NOT NULL,
        "endDate" timestamp NOT NULL,
        "category" varchar(50) NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now()
      );
    `;
    console.log("calendar_events table created successfully in database!");
  } catch (err) {
    console.error("Failed to create calendar_events table:", err);
  }
  process.exit(0);
}

main();
