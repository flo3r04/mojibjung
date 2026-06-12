import { getDb } from "./server/db.js";
import { users, emailVerifications } from "./drizzle/schema.js";

async function run() {
  try {
    const db = await getDb();
    if (!db) {
      console.log("❌ 데이터베이스 연결에 실패했습니다.");
      process.exit(1);
    }

    console.log("🔄 모든 로컬 사용자들의 인증 정보를 리셋하여 'pending' 상태로 초기화합니다...");

    // 1. 모든 사용자의 상태를 pending으로 되돌리고 학교 인증 정보 초기화
    const resetUsers = await db
      .update(users)
      .set({
        status: "pending",
        realName: null,
        studentId: null,
        admissionYear: null,
        verifiedEmail: null,
      })
      .returning();

    // 2. 이메일 인증 시도 이력 비우기
    await db.delete(emailVerifications);

    console.log(`✅ 초기화 성공! 총 ${resetUsers.length}명의 사용자가 'pending' 상태로 변경되었습니다.`);
    console.log("👉 이제 웹사이트에 로그인하시면 즉시 이메일 인증 단계(Step 1)가 강제 활성화됩니다.");
  } catch (err) {
    console.error("❌ DB 초기화 오류 발생:", err);
  }
  process.exit(0);
}
run();
