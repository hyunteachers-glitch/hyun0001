// 작품 제목 정리/비교 유틸 — 작품 생성, 제목 수정, 중복 검사가 모두 이 함수들을 쓴다.

// 공백으로 취급할 문자: 일반 공백·탭·줄바꿈 등(\s) + 줄바꿈 없는 공백(U+00A0) + 전각 공백(U+3000)
// (\s에 이미 포함돼 있지만 의도를 드러내려고 명시)
const WS = "\\s\\u00A0\\u3000";
const EDGE_WHITESPACE = new RegExp(`^[${WS}]+|[${WS}]+$`, "g");
const INNER_WHITESPACE = new RegExp(`[${WS}]+`, "g");

/** 저장용: 제목 앞뒤 공백 제거 (가운데 공백은 그대로 둔다) */
export function cleanTitle(value: string): string {
  return value.replace(EDGE_WHITESPACE, "");
}

/** 비교용: 앞뒤 공백 제거 + 연속 공백을 하나로 + 대소문자 무시 (한글은 영향 없음) */
export function normalizeTitleForCompare(value: string): string {
  return cleanTitle(value).replace(INNER_WHITESPACE, " ").toLowerCase();
}
