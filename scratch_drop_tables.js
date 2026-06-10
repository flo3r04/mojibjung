import postgres from 'postgres';

const databaseUrl = "postgresql://mojibjung_db_user:AJuLGQaYp0O03esgxiqGzBtr0PpFU4jd@dpg-d8klerernols73fsnqf0-a.oregon-postgres.render.com/mojibjung_db?sslmode=require";

async function run() {
  const sql = postgres(databaseUrl);
  try {
    console.log("Dropping tables emailVerifications and verificationTokens...");
    await sql`DROP TABLE IF EXISTS "emailVerifications" CASCADE;`;
    await sql`DROP TABLE IF EXISTS "verificationTokens" CASCADE;`;
    console.log("Dropped successfully.");
  } catch (err) {
    console.error("Error dropping tables:", err);
  } finally {
    await sql.end();
  }
}

run();
