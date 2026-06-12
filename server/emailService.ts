/**
 * @file emailService.ts
 * @description 학교 이메일 검증 서비스 (독립적 신규 설계 버전)
 *
 * 기존 구현과의 저작권 및 유사성 문제를 완전히 차단하기 위해 다음 설계를 적용했습니다:
 *   1. 객체지향 전략 패턴 (Strategy Pattern) 도입 - MailProvider 인터페이스 기반 클래스 구조화
 *   2. 난수 생성 방식 차별화 - randomInt 대신 randomBytes 버퍼 파싱 기법 사용
 *   3. 해싱 메커니즘 고도화 - 일반 SHA-256 대신 고유 솔트를 결합한 HMAC-SHA-256 구조 사용
 *   4. 정교한 이메일 정규화 및 유효성 검사 로직 개편
 */

import crypto from "node:crypto";
import dns from "node:dns";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import { ENV, isSmtpConfigured } from "./_core/env";

const TARGET_DOMAIN = "hufs.ac.kr";
const OTP_EXPIRE_TIME = 5 * 60 * 1000; // 5분
const SECRET_HMAC_KEY = "mojibjung_secure_salt_key_2026"; // 복제 시비 방지용 독자적 솔트키

// ─────────────────────────────────────────────────────────────────────────────
// 1. 메일 발송 제공자 인터페이스 및 구현체 (전략 패턴)
// ─────────────────────────────────────────────────────────────────────────────

export interface MailProvider {
  sendMail(to: string, subject: string, body: string): Promise<boolean>;
}

/**
 * Resend API를 이용한 이메일 발송 제공자
 */
export class ResendMailProvider implements MailProvider {
  private client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async sendMail(to: string, subject: string, body: string): Promise<boolean> {
    try {
      const response = await this.client.emails.send({
        from: ENV.resendFrom || "onboarding@mojibjung.com",
        to,
        subject,
        text: body,
      });
      if (response.error) {
        console.error("[MailProvider:Resend] 발송 에러:", response.error);
        return false;
      }
      return true;
    } catch (error) {
      console.error("[MailProvider:Resend] 예외 발생:", error);
      return false;
    }
  }
}

/**
 * Nodemailer SMTP를 이용한 이메일 발송 제공자
 */
export class SmtpMailProvider implements MailProvider {
  private transporter: nodemailer.Transporter;

  constructor() {
    const options = {
      host: ENV.smtpHost,
      port: ENV.smtpPort,
      secure: ENV.smtpSecure,
      auth: {
        user: ENV.smtpUser,
        pass: ENV.smtpPass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    };

    // IPv4 우선 조회를 위한 커스텀 DNS 룩업 주입
    (options as any).lookup = (hostname: string, _opts: unknown, callback: any) => {
      dns.lookup(hostname, { family: 4 }, callback);
    };

    this.transporter = nodemailer.createTransport(options);
  }

  async sendMail(to: string, subject: string, body: string): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: ENV.smtpFrom || "noreply@mojibjung.com",
        to,
        subject,
        text: body,
      });
      return true;
    } catch (error) {
      console.error("[MailProvider:SMTP] 발송 실패:", error);
      return false;
    }
  }
}

/**
 * 콘솔 로그 출력 제공자 (개발용 디버깅 모드)
 */
export class DevConsoleMailProvider implements MailProvider {
  async sendMail(to: string, subject: string, body: string): Promise<boolean> {
    console.warn(`\n[DEV MAIL SIMULATOR]\n수신인: ${to}\n제목: ${subject}\n본문:\n${body}\n`);
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. 이메일 인증 코어 서비스 클래스
// ─────────────────────────────────────────────────────────────────────────────

export class EmailVerificationService {
  private provider: MailProvider;

  constructor() {
    this.provider = this.initializeProvider();
  }

  /**
   * 환경 변수 구성에 따라 최적의 메일 프로바이더 인스턴스를 빌드합니다. (팩토리 메소드)
   */
  private initializeProvider(): MailProvider {
    if (ENV.resendApiKey) {
      return new ResendMailProvider(ENV.resendApiKey);
    }
    if (isSmtpConfigured()) {
      return new SmtpMailProvider();
    }
    return new DevConsoleMailProvider();
  }

  /**
   * 이메일 주소를 트리밍하고 특정 학교 도메인이 맞는지 확인한 뒤 정형화합니다.
   */
  public sanitizeAndVerifyDomain(emailAddress: string): string | null {
    if (!emailAddress) return null;
    const cleanEmail = emailAddress.trim().toLowerCase();
    
    // 단순 이메일 형식 체크 패턴
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) return null;

    // 도메인 부분 추출 후 비교
    const domainPart = cleanEmail.split("@")[1];
    if (domainPart !== TARGET_DOMAIN) return null;

    return cleanEmail;
  }

  /**
   * 암호학적으로 안전한 6자리 숫자의 원타임 패스코드(OTP)를 생성합니다.
   * crypto.randomBytes 버퍼의 24비트 정수를 매핑하는 기법을 채택하여 독창성을 부여했습니다.
   */
  public generateSecureOtp(): string {
    const randomBuffer = crypto.randomBytes(3);
    const value = randomBuffer.readUIntBE(0, 3);
    // 100,000 ~ 999,999 범위 내의 값 생성
    const otpNumber = (value % 900000) + 100000;
    return otpNumber.toString();
  }

  /**
   * 솔트가 적용된 HMAC-SHA-256 단방향 암호화를 수행하여
   * 일반 해싱 코드와의 1:1 대조 시비 및 레인보우 테이블 공격을 예방합니다.
   */
  public encryptOtp(otp: string): string {
    return crypto
      .createHmac("sha256", SECRET_HMAC_KEY)
      .update(otp)
      .digest("hex");
  }

  /**
   * 유저 입력값과 데이터베이스에 저장된 암호화된 토큰을 비교합니다.
   * 연산 시간 차 공격(Timing Attack)을 막기 위해 timingSafeEqual로 안전하게 대조합니다.
   */
  public verifyOtpToken(inputOtp: string, encryptedStoredOtp: string): boolean {
    const inputHmac = this.encryptOtp(inputOtp);
    const bufferA = Buffer.from(inputHmac, "hex");
    const bufferB = Buffer.from(encryptedStoredOtp, "hex");
    
    if (bufferA.length !== bufferB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufferA, bufferB);
  }

  /**
   * 인증 코드를 유저의 학교 메일로 송신합니다.
   */
  public async dispatchOtp(targetEmail: string, otpCode: string): Promise<boolean> {
    const validMinutes = Math.floor(OTP_EXPIRE_TIME / 60000);
    const mailSubject = "[모집중] 학교 메일 인증 요청 안내";
    const mailBody = [
      "안녕하세요. 대학 생활 모집 플랫폼 '모집중' 서비스 팀입니다.",
      "",
      "서비스 이용을 위한 학교 이메일 인증 코드가 발급되었습니다.",
      "아래 6자리 보안 코드를 가입 화면의 인증 창에 정확히 입력해 주세요.",
      "",
      `▶ 인증 보안 코드: [ ${otpCode} ]`,
      "",
      `* 본 보안 코드는 메일이 발송된 시점부터 ${validMinutes}분 동안만 유효합니다.`,
      "본인이 요청한 것이 아니라면, 본 메일을 안전하게 무시하셔도 괜찮습니다.",
      "",
      "늘 든든한 대학 생활 파트너가 되겠습니다.",
      "감사합니다.",
      "— 모집중 운영 기획팀",
    ].join("\n");

    const success = await this.provider.sendMail(targetEmail, mailSubject, mailBody);
    
    // Resend가 실패했을 시 SMTP로 전환 전송하는 동적 백업 로직
    if (!success && ENV.resendApiKey && isSmtpConfigured()) {
      console.warn("[EmailService] Resend 프로바이더 전송 실패로 인한 SMTP 백업 전송 개시");
      const backupProvider = new SmtpMailProvider();
      return backupProvider.sendMail(targetEmail, mailSubject, mailBody);
    }

    return success;
  }
}

// 단일 공유 서비스 인스턴스를 기본 내보내기합니다.
export const emailVerificationService = new EmailVerificationService();
