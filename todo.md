# HUFS Global Campus Community - TODO

## DB 스키마
- [x] profiles 테이블 (userId, 학과, 학년, 관심 키워드)
- [x] posts 테이블 (카테고리, 제목, 내용, 모집인원, 마감일, 키워드 태그)
- [x] applications 테이블 (postId, userId, 한줄소개, 상태: pending/accepted/rejected)

## 백엔드 API (tRPC)
- [x] profile.get / profile.upsert
- [x] post.list (카테고리 필터, 키워드 검색, 정렬)
- [x] post.get (단건 조회)
- [x] post.create / post.update / post.delete
- [x] post.recommended (키워드 매칭 추천)
- [x] application.submit (신청, 중복 방지)
- [x] application.listByPost (작성자: 신청자 목록)
- [x] application.listByUser (신청자: 내 신청 목록)
- [x] application.updateStatus (수락/거절)

## 프론트엔드 페이지
- [x] 글로벌 스타일 (스칸디나비안 디자인, 색상 팔레트, 폰트)
- [x] 공통 레이아웃 및 네비게이션 바
- [x] 홈 페이지 (히어로, 추천 게시글, 카테고리 진입)
- [x] 게시판 목록 페이지 (카테고리 필터, 키워드 검색, 정렬)
- [x] 게시글 상세 페이지 (내용, 작성자 프로필, 신청 버튼)
- [x] 게시글 작성/수정 페이지
- [x] 프로필 작성/수정 페이지
- [x] 마이페이지 (내 게시글, 내 신청 목록 및 상태)
- [x] 신청 현황 관리 (작성자: 신청자 목록, 수락/거절)

## 기능 검증
- [x] 신청 중복 방지 로직 (DB unique constraint + 서버 체크)
- [x] 키워드 기반 추천 정렬 로직
- [x] 수락/거절 상태 실시간 반영
- [x] Vitest 테스트 작성 (9/9 통과)
