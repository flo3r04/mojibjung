-- 1. users 테이블 정리 및 확장 (이메일 인증 제거 및 아바타 추가)
ALTER TABLE "users" ADD COLUMN "avatarUrl" text;
ALTER TABLE "users" DROP COLUMN IF EXISTS "isVerified";
ALTER TABLE "users" DROP COLUMN IF EXISTS "verifiedEmail";

-- 2. posts 테이블 확장 (이미지 URL 추가)
ALTER TABLE "posts" ADD COLUMN "imageUrl" text;

-- 3. 댓글(comments) 테이블 생성
CREATE TABLE IF NOT EXISTS "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"postId" integer NOT NULL,
	"authorId" integer NOT NULL,
	"parentId" integer,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

-- 4. 좋아요(likes) 테이블 생성
CREATE TABLE IF NOT EXISTS "likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"postId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

-- 5. 북마크(bookmarks) 테이블 생성
CREATE TABLE IF NOT EXISTS "bookmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"postId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

-- 6. 사용하지 않는 이메일 인증 테이블 삭제
DROP TABLE IF EXISTS "email_verifications";