import postgres from "postgres";
import { config } from "dotenv";

config();

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  console.log("DATABASE_URL:", dbUrl);
  if (!dbUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const sql = postgres(dbUrl);
  try {
    console.log("Checking tables...");
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    console.log("Tables list:");
    console.log(tables.map(t => t.table_name).join(", "));

    // Check calendar_todos
    try {
      console.log("\n--- calendar_todos columns ---");
      const columns = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'calendar_todos';
      `;
      console.table(columns);
    } catch (e) {
      console.error("Error reading calendar_todos columns:", e.message);
    }

    // Check calendar_events
    try {
      console.log("\n--- calendar_events columns ---");
      const columns = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'calendar_events';
      `;
      console.table(columns);
    } catch (e) {
      console.error("Error reading calendar_events columns:", e.message);
    }

    // Try a sample insert on calendar_todos to see the raw error
    try {
      console.log("\n--- Testing insert calendar_todos ---");
      await sql`
        INSERT INTO "calendar_todos" ("userId", "date", "content")
        VALUES (29, '2026-06-12', '개발하기');
      `;
      console.log("Insert success!");
    } catch (e) {
      console.error("Insert into calendar_todos failed:", e);
    }

  } catch (err) {
    console.error("Database error:", err);
  } finally {
    await sql.end();
  }
}

main();
