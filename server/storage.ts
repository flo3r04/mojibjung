import { v2 as cloudinary } from 'cloudinary';
import { ENV } from './_core/env';

// Cloudinary 설정
cloudinary.config({
  cloud_name: ENV.cloudinaryCloudName,
  api_key: ENV.cloudinaryApiKey,
  api_secret: ENV.cloudinaryApiSecret,
});

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  try {
    // Buffer 또는 Base64 데이터를 Cloudinary에 업로드
    let uploadContent: string;
    if (typeof data === 'string') {
      uploadContent = data; // 이미 base64일 경우
    } else {
      const base64 = Buffer.from(data).toString('base64');
      uploadContent = `data:${contentType};base64,${base64}`;
    }

    const result = await cloudinary.uploader.upload(uploadContent, {
      folder: 'moji',
      public_id: relKey.replace(/\//g, '_').split('.')[0], // 경로 구조를 ID로 변환
      resource_type: 'auto',
    });

    return { 
      key: result.public_id, 
      url: result.secure_url 
    };
  } catch (error) {
    console.error("[Storage] Cloudinary 업로드 실패:", error);
    throw new Error("이미지 저장소 연결에 실패했습니다. 환경 변수를 확인해주세요.");
  }
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  // Cloudinary는 URL이 고정적이므로 단순 반환 (또는 SDK 사용 가능)
  // 실제로는 DB에 저장된 URL을 직접 쓰는 경우가 많지만 인터페이스 유지를 위해 남겨둡니다.
  return {
    key: relKey,
    url: cloudinary.url(relKey, { secure: true }),
  };
}
