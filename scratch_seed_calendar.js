import postgres from "postgres";
import { config } from "dotenv";

config();

const academicEvents = [
  // 1학기 학사일정
  { title: "[학사] 1학기 개강", category: "academic", startDate: "2026-03-03 00:00:00", endDate: "2026-03-03 23:59:59" },
  { title: "[학사] 1학기 수강신청 변경 기간", category: "academic", startDate: "2026-03-03 00:00:00", endDate: "2026-03-09 23:59:59" },
  { title: "[학사] 1학기 수강신청 취소 기간", category: "academic", startDate: "2026-03-24 00:00:00", endDate: "2026-03-30 23:59:59" },
  { title: "[학사] 개교기념일 (휴강)", category: "academic", startDate: "2026-04-20 00:00:00", endDate: "2026-04-20 23:59:59" },
  { title: "[학사] 1학기 중간시험 주간", category: "academic", startDate: "2026-04-21 00:00:00", endDate: "2026-04-27 23:59:59" },
  { title: "[학사] 1학기 보강 주간", category: "academic", startDate: "2026-06-09 00:00:00", endDate: "2026-06-15 23:59:59" },
  { title: "[학사] 1학기 기말시험 주간", category: "academic", startDate: "2026-06-16 00:00:00", endDate: "2026-06-22 23:59:59" },
  { title: "[학사] 1학기 종강", category: "academic", startDate: "2026-06-22 00:00:00", endDate: "2026-06-22 23:59:59" },
  { title: "[학사] 하계 계절학기", category: "academic", startDate: "2026-06-23 00:00:00", endDate: "2026-07-13 23:59:59" },

  // 2학기 학사일정
  { title: "[학사] 2학기 수강신청 기간", category: "academic", startDate: "2026-08-10 00:00:00", endDate: "2026-08-14 23:59:59" },
  { title: "[학사] 2학기 개강", category: "academic", startDate: "2026-09-01 00:00:00", endDate: "2026-09-01 23:59:59" },
  { title: "[학사] 2학기 수강신청 변경 기간", category: "academic", startDate: "2026-09-01 00:00:00", endDate: "2026-09-07 23:59:59" },
  { title: "[학사] 2학기 수강신청 취소 기간", category: "academic", startDate: "2026-09-22 00:00:00", endDate: "2026-09-28 23:59:59" },
  { title: "[학사] 2학기 중간시험 주간", category: "academic", startDate: "2026-10-20 00:00:00", endDate: "2026-10-26 23:59:59" },
  { title: "[학사] 2학기 보강 주간", category: "academic", startDate: "2026-12-08 00:00:00", endDate: "2026-12-14 23:59:59" },
  { title: "[학사] 2학기 기말시험 주간", category: "academic", startDate: "2026-12-15 00:00:00", endDate: "2026-12-21 23:59:59" },
  { title: "[학사] 2학기 종강", category: "academic", startDate: "2026-12-21 00:00:00", endDate: "2026-12-21 23:59:59" },
  { title: "[학사] 동계 계절학기", category: "academic", startDate: "2026-12-22 00:00:00", endDate: "2027-01-12 23:59:59" },

  // 2026년 공휴일
  { title: "신정", category: "holiday", startDate: "2026-01-01 00:00:00", endDate: "2026-01-01 23:59:59" },
  { title: "설날 연휴", category: "holiday", startDate: "2026-02-16 00:00:00", endDate: "2026-02-18 23:59:59" },
  { title: "삼일절", category: "holiday", startDate: "2026-03-01 00:00:00", endDate: "2026-03-01 23:59:59" },
  { title: "어린이날", category: "holiday", startDate: "2026-05-05 00:00:00", endDate: "2026-05-05 23:59:59" },
  { title: "부처님오신날", category: "holiday", startDate: "2026-05-24 00:00:00", endDate: "2026-05-24 23:59:59" },
  { title: "부처님오신날 대체공휴일", category: "holiday", startDate: "2026-05-25 00:00:00", endDate: "2026-05-25 23:59:59" },
  { title: "현충일", category: "holiday", startDate: "2026-06-06 00:00:00", endDate: "2026-06-06 23:59:59" },
  { title: "광복절", category: "holiday", startDate: "2026-08-15 00:00:00", endDate: "2026-08-15 23:59:59" },
  { title: "추석 연휴", category: "holiday", startDate: "2026-09-24 00:00:00", endDate: "2026-09-26 23:59:59" },
  { title: "개천절", category: "holiday", startDate: "2026-10-03 00:00:00", endDate: "2026-10-03 23:59:59" },
  { title: "한글날", category: "holiday", startDate: "2026-10-09 00:00:00", endDate: "2026-10-09 23:59:59" },
  { title: "크리스마스", category: "holiday", startDate: "2026-12-25 00:00:00", endDate: "2026-12-25 23:59:59" },
];

async function main() {
  const sql = postgres(process.env.DATABASE_URL);
  try {
    // 기존 학사일정/공휴일 초기화 (재실행 가능하게)
    await sql`DELETE FROM calendar_events WHERE category IN ('academic', 'holiday')`;
    
    // 데이터 주입
    for (const e of academicEvents) {
      await sql`
        INSERT INTO calendar_events (title, category, "startDate", "endDate")
        VALUES (${e.title}, ${e.category}, ${e.startDate}, ${e.endDate})
      `;
    }
    
    console.log(`Successfully seeded ${academicEvents.length} calendar events!`);
  } catch (err) {
    console.error("Seeding failed:", err);
  }
  process.exit(0);
}

main();
