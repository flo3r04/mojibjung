import { getDb } from "./server/db.js";
import { reports } from "./drizzle/schema.js";

async function run() {
  try {
    const db = await getDb();
    if (!db) {
      console.log("No DB connection");
      process.exit(1);
    }
    const res = await db.insert(reports).values({
      reporterId: 1, // Change if needed
      targetType: "post",
      targetId: 1,
      reason: "test test",
    }).returning();
    console.log("Success:", res);
  } catch (err) {
    console.error("DB Error:", err);
  }
  process.exit(0);
}
run();
