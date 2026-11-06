import type { SyntheticEvent } from "react";

// 썸네일 URL 규칙 — DB 컬럼 없이 원본 URL만으로 계산한다.
//   원본:   {R2_PUBLIC_URL}/uploads/{나머지 키}
//   썸네일: {R2_PUBLIC_URL}/thumbs/uploads/{나머지 키}.webp
// 원본 키는 인코딩 없이 그대로 이어붙인다(업로드 시 publicUrl을 만드는 방식과 동일).
//
// 클라이언트 컴포넌트에서도 쓰려면 NEXT_PUBLIC_R2_PUBLIC_URL이 필요하다
// (R2_PUBLIC_URL은 서버 전용이라 브라우저 번들에서는 undefined).
// 둘 다 없으면 항상 원본을 반환하므로 안전하다.
// process.env.XXX는 리터럴로 접근해야 빌드 시 인라인된다.
const R2_PUBLIC_BASE = (
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
  process.env.R2_PUBLIC_URL ||
  ""
).replace(/\/+$/, "");

const ORIGINAL_DIR = "uploads/";
const THUMB_DIR = "thumbs/";
const THUMB_EXT = ".webp";

export function getThumbUrl(originalUrl: string | null | undefined): string {
  if (typeof originalUrl !== "string" || !originalUrl) return originalUrl ?? "";
  if (!R2_PUBLIC_BASE) return originalUrl;

  const originalPrefix = `${R2_PUBLIC_BASE}/${ORIGINAL_DIR}`;
  if (!originalUrl.startsWith(originalPrefix)) return originalUrl;

  const rest = originalUrl.slice(originalPrefix.length);
  // 키가 비었거나, 쿼리/해시가 붙은 등 예상과 다른 형식이면 원본 그대로
  if (!rest || rest.endsWith("/") || /[?#]/.test(rest)) return originalUrl;

  return `${R2_PUBLIC_BASE}/${THUMB_DIR}${ORIGINAL_DIR}${rest}${THUMB_EXT}`;
}

// 썸네일 로드 실패 시 원본으로 한 번만 되돌리는 onError 핸들러.
//   <img src={getThumbUrl(url)} onError={createThumbFallback(url)} />
// - 이미 이 원본으로 대체했으면(원본도 실패) 다시 바꾸지 않아 무한 반복이 없다.
// - 대체 여부를 원본 URL 기준으로 기록하므로, 같은 <img> DOM이 다른 이미지로
//   재사용돼도 새 이미지에 대해서는 다시 한 번 대체할 수 있다.
export function createThumbFallback(originalUrl: string) {
  return (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;

    if (img.dataset.thumbFallback === originalUrl) return;
    img.dataset.thumbFallback = originalUrl;

    img.removeAttribute("srcset");
    img.src = originalUrl;
  };
}
