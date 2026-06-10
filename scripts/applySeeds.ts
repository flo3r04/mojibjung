/**
 * drizzle/seeds/*.sql 파일들을 알파벳 순서로 DATABASE_URL 에 적용한다.
 *
 *   pnpm db:seed
 *
 * 각 SQL 은 idempotent (ON CONFLICT DO NOTHING / UPDATE WHERE) 해야 한다.
 * 마이그레이션(DDL) 은 drizzle-kit 의 일이고, 이 스크립트는 데이터 시드 전용.
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[seed] DATABASE_URL is not set");
  process.exit(1);
}

const SEEDS_DIR = path.resolve(process.cwd(), "drizzle/seeds");

async function main() {
  if (!fs.existsSync(SEEDS_DIR)) {
    console.warn(`[seed] no seeds directory: ${SEEDS_DIR}`);
    return;
  }

  const files = fs
    .readdirSync(SEEDS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("[seed] no .sql files found");
    return;
  }

  const sql = postgres(DATABASE_URL, { max: 1 });

  try {
    for (const file of files) {
      const fullPath = path.join(SEEDS_DIR, file);
      const content = fs.readFileSync(fullPath, "utf8");
      console.log(`[seed] applying ${file} ...`);
      await sql.unsafe(content);
      console.log(`[seed] ✓ ${file}`);
    }
    console.log(`[seed] done — ${files.length} file(s) applied`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
