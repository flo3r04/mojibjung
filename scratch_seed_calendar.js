import postgres from "postgres";
import { config } from "dotenv";

config();

const academicEvents = [
  // 1학기 학사일정
  { title: "[학사] 삼일절·학기개시일", category: "academic", startDate: "2026-03-01 00:00:00", endDate: "2026-03-01 23:59:59" },
  { title: "[학사] 제1학기 개강·대체휴업일", category: "academic", startDate: "2026-03-02 00:00:00", endDate: "2026-03-02 23:59:59" },
  { title: "[학사] 제1학기 개강", category: "academic", startDate: "2026-03-03 00:00:00", endDate: "2026-03-03 23:59:59" },
  { title: "[학사] 수강신청 변경", category: "academic", startDate: "2026-03-03 00:00:00", endDate: "2026-03-09 23:59:59" },
  { title: "[학사] 수강신청 취소", category: "academic", startDate: "2026-03-24 00:00:00", endDate: "2026-03-30 23:59:59" },
  { title: "[학사] 제1학기 1/4선", category: "academic", startDate: "2026-03-30 00:00:00", endDate: "2026-03-30 23:59:59" },
  { title: "[학사] 제72주년 개교기념일", category: "academic", startDate: "2026-04-20 00:00:00", endDate: "2026-04-20 23:59:59" },
  { title: "[학사] 제1학기 중간시험", category: "academic", startDate: "2026-04-21 00:00:00", endDate: "2026-04-27 23:59:59" },
  { title: "[학사] 제1학기 2/4선", category: "academic", startDate: "2026-04-27 00:00:00", endDate: "2026-04-27 23:59:59" },
  { title: "[학사] 제1학기 중간성적 입력 및 확인", category: "academic", startDate: "2026-04-27 00:00:00", endDate: "2026-05-04 23:59:59" },
  { title: "[학사] 제1학기 3/4선", category: "academic", startDate: "2026-05-25 00:00:00", endDate: "2026-05-25 23:59:59" },
  { title: "[학사] 제1학기 보강주간", category: "academic", startDate: "2026-06-09 00:00:00", endDate: "2026-06-15 23:59:59" },
  { title: "[학사] 졸업시험 성적보고서 및 졸업논문 심사보고서 제출 마감", category: "academic", startDate: "2026-06-15 00:00:00", endDate: "2026-06-15 23:59:59" },
  { title: "[학사] 제1학기 기말시험", category: "academic", startDate: "2026-06-16 00:00:00", endDate: "2026-06-22 23:59:59" },
  { title: "[학사] 제1학기 종강", category: "academic", startDate: "2026-06-22 00:00:00", endDate: "2026-06-22 23:59:59" },
  { title: "[학사] 제1학기 성적입력", category: "academic", startDate: "2026-06-22 00:00:00", endDate: "2026-06-29 23:59:59" },
  { title: "[학사] 하계방학 및 계절학기 개강", category: "academic", startDate: "2026-06-23 00:00:00", endDate: "2026-06-23 23:59:59" },
  { title: "[학사] 제1학기 성적 열람 및 정정", category: "academic", startDate: "2026-06-30 00:00:00", endDate: "2026-07-06 23:59:59" },
  { title: "[학사] 계절학기 종강", category: "academic", startDate: "2026-07-13 00:00:00", endDate: "2026-07-13 23:59:59" },
  { title: "[학사] 2026년 후기 졸업 사정회의", category: "academic", startDate: "2026-07-29 00:00:00", endDate: "2026-07-29 23:59:59" },

  // 2학기 학사일정
  { title: "[학사] 제2학기 휴․복학 신청", category: "academic", startDate: "2026-08-03 00:00:00", endDate: "2026-08-07 23:59:59" },
  { title: "[학사] 사전수강신청", category: "academic", startDate: "2026-08-03 00:00:00", endDate: "2026-08-03 23:59:59" },
  { title: "[학사] 수강신청", category: "academic", startDate: "2026-08-10 00:00:00", endDate: "2026-08-14 23:59:59" },
  { title: "[학사] 2026년 후기 학위수여식", category: "academic", startDate: "2026-08-21 00:00:00", endDate: "2026-08-21 23:59:59" },
  { title: "[학사] 제2학기 학기개시일·개강", category: "academic", startDate: "2026-09-01 00:00:00", endDate: "2026-09-01 23:59:59" },
  { title: "[학사] 수강신청 변경", category: "academic", startDate: "2026-09-01 00:00:00", endDate: "2026-09-07 23:59:59" },
  { title: "[학사] 수강신청 취소", category: "academic", startDate: "2026-09-22 00:00:00", endDate: "2026-09-28 23:59:59" },
  { title: "[학사] 제2학기 1/4선", category: "academic", startDate: "2026-09-28 00:00:00", endDate: "2026-09-28 23:59:59" },
  { title: "[학사] 제2학기 중간시험", category: "academic", startDate: "2026-10-20 00:00:00", endDate: "2026-10-26 23:59:59" },
  { title: "[학사] 제2학기 2/4선", category: "academic", startDate: "2026-10-26 00:00:00", endDate: "2026-10-26 23:59:59" },
  { title: "[학사] 제2학기 중간성적 입력 및 확인", category: "academic", startDate: "2026-10-26 00:00:00", endDate: "2026-11-02 23:59:59" },
  { title: "[학사] 제2학기 3/4선", category: "academic", startDate: "2026-11-23 00:00:00", endDate: "2026-11-23 23:59:59" },
  { title: "[학사] 제2학기 보강주간", category: "academic", startDate: "2026-12-08 00:00:00", endDate: "2026-12-14 23:59:59" },
  { title: "[학사] 졸업시험 성적보고서 및 졸업논문 심사보고서 제출 마감", category: "academic", startDate: "2026-12-14 00:00:00", endDate: "2026-12-14 23:59:59" },
  { title: "[학사] 제2학기 기말시험", category: "academic", startDate: "2026-12-15 00:00:00", endDate: "2026-12-21 23:59:59" },
  { title: "[학사] 제2학기 종강", category: "academic", startDate: "2026-12-21 00:00:00", endDate: "2026-12-21 23:59:59" },
  { title: "[학사] 제2학기 성적입력", category: "academic", startDate: "2026-12-21 00:00:00", endDate: "2026-12-28 23:59:59" },
  { title: "[학사] 동계방학 및 계절학기 개강", category: "academic", startDate: "2026-12-22 00:00:00", endDate: "2026-12-22 23:59:59" },
  { title: "[학사] 제2학기 성적 열람 및 정정", category: "academic", startDate: "2026-12-28 00:00:00", endDate: "2027-01-04 23:59:59" },

  // 2027년 연초 학사일정
  { title: "[학사] 계절학기 종강", category: "academic", startDate: "2027-01-13 00:00:00", endDate: "2027-01-13 23:59:59" },
  { title: "[학사] 2027년 전기 졸업 사정회의", category: "academic", startDate: "2027-01-27 00:00:00", endDate: "2027-01-27 23:59:59" },
  { title: "[학사] 사전수강신청(1차)", category: "academic", startDate: "2027-01-28 00:00:00", endDate: "2027-01-29 23:59:59" },
  { title: "[학사] 2027학년도 제1학기 휴․복학신청", category: "academic", startDate: "2027-02-01 00:00:00", endDate: "2027-02-05 23:59:59" },
  { title: "[학사] 사전수강신청(2차)", category: "academic", startDate: "2027-02-04 00:00:00", endDate: "2027-02-04 23:59:59" },
  { title: "[학사] 수강신청(2~4학년)", category: "academic", startDate: "2027-02-10 00:00:00", endDate: "2027-02-12 23:59:59" },
  { title: "[학사] 2027년 전기 학위수여식", category: "academic", startDate: "2027-02-19 00:00:00", endDate: "2027-02-19 23:59:59" },
  { title: "[학사] 수강신청(1학년, 전체)", category: "academic", startDate: "2027-02-22 00:00:00", endDate: "2027-02-23 23:59:59" },

  // 2026년 공휴일
  { title: "신정", category: "holiday", startDate: "2026-01-01 00:00:00", endDate: "2026-01-01 23:59:59" },
  { title: "설날 연휴", category: "holiday", startDate: "2026-02-16 00:00:00", endDate: "2026-02-18 23:59:59" },
  { title: "삼일절", category: "holiday", startDate: "2026-03-01 00:00:00", endDate: "2026-03-01 23:59:59" },
  { title: "노동절", category: "holiday", startDate: "2026-05-01 00:00:00", endDate: "2026-05-01 23:59:59" },
  { title: "어린이날", category: "holiday", startDate: "2026-05-05 00:00:00", endDate: "2026-05-05 23:59:59" },
  { title: "부처님오신날", category: "holiday", startDate: "2026-05-24 00:00:00", endDate: "2026-05-24 23:59:59" },
  { title: "대체휴업일", category: "holiday", startDate: "2026-05-25 00:00:00", endDate: "2026-05-25 23:59:59" },
  { title: "제9회 전국동시지방선거", category: "holiday", startDate: "2026-06-03 00:00:00", endDate: "2026-06-03 23:59:59" },
  { title: "현충일", category: "holiday", startDate: "2026-06-06 00:00:00", endDate: "2026-06-06 23:59:59" },
  { title: "광복절", category: "holiday", startDate: "2026-08-15 00:00:00", endDate: "2026-08-15 23:59:59" },
  { title: "대체휴업일", category: "holiday", startDate: "2026-08-17 00:00:00", endDate: "2026-08-17 23:59:59" },
  { title: "추석 연휴", category: "holiday", startDate: "2026-09-24 00:00:00", endDate: "2026-09-26 23:59:59" },
  { title: "개천절", category: "holiday", startDate: "2026-10-03 00:00:00", endDate: "2026-10-03 23:59:59" },
  { title: "대체휴업일", category: "holiday", startDate: "2026-10-05 00:00:00", endDate: "2026-10-05 23:59:59" },
  { title: "한글날", category: "holiday", startDate: "2026-10-09 00:00:00", endDate: "2026-10-09 23:59:59" },
  { title: "성탄절", category: "holiday", startDate: "2026-12-25 00:00:00", endDate: "2026-12-25 23:59:59" },

  // 2027년 공휴일
  { title: "신정", category: "holiday", startDate: "2027-01-01 00:00:00", endDate: "2027-01-01 23:59:59" },
  { title: "설날 연휴", category: "holiday", startDate: "2027-02-06 00:00:00", endDate: "2027-02-08 23:59:59" },
  { title: "대체휴업일", category: "holiday", startDate: "2027-02-09 00:00:00", endDate: "2027-02-09 23:59:59" }
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
