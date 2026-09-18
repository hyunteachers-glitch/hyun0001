import type { Keyword } from "@/lib/types";

const CHOSEONG_LIST = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ",
  "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
] as const;

const CHOSEONG_TO_GROUP: Record<string, string> = {
  "ㄱ": "ㄱ", "ㄲ": "ㄱ",
  "ㄴ": "ㄴ",
  "ㄷ": "ㄷ", "ㄸ": "ㄷ",
  "ㄹ": "ㄹ",
  "ㅁ": "ㅁ",
  "ㅂ": "ㅂ", "ㅃ": "ㅂ",
  "ㅅ": "ㅅ", "ㅆ": "ㅅ",
  "ㅇ": "ㅇ",
  "ㅈ": "ㅈ", "ㅉ": "ㅈ",
  "ㅊ": "ㅊ",
  "ㅋ": "ㅋ",
  "ㅌ": "ㅌ",
  "ㅍ": "ㅍ",
  "ㅎ": "ㅎ",
};

const KOREAN_GROUP_ORDER = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

export const SECTION_ORDER = [...KOREAN_GROUP_ORDER, "A-Z", "0-9", "기타"];

export function getChoseong(char: string): string | null {
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;

  const choseongIndex = Math.floor((code - 0xac00) / (21 * 28));
  return CHOSEONG_LIST[choseongIndex];
}

export function getGroupKey(name: string): string {
  const first = name.trim().charAt(0);
  if (!first) return "기타";

  const choseong = getChoseong(first);
  if (choseong) return CHOSEONG_TO_GROUP[choseong];

  if (/[A-Za-z]/.test(first)) return "A-Z";
  if (/[0-9]/.test(first)) return "0-9";

  return "기타";
}

function compareWithinGroup(key: string, a: string, b: string): number {
  if (key === "0-9") {
    const diff = parseInt(a, 10) - parseInt(b, 10);
    return diff !== 0 ? diff : a.localeCompare(b);
  }

  if (key === "A-Z") {
    return a.localeCompare(b, "en", { sensitivity: "base" });
  }

  return a.localeCompare(b, "ko");
}

export function compareKeywords(a: Keyword, b: Keyword): number {
  const keyA = getGroupKey(a.name);
  const keyB = getGroupKey(b.name);

  if (keyA !== keyB) {
    return SECTION_ORDER.indexOf(keyA) - SECTION_ORDER.indexOf(keyB);
  }

  return compareWithinGroup(keyA, a.name, b.name);
}

export type KeywordSection = {
  key: string;
  items: Keyword[];
};

export function groupKeywords(keywords: Keyword[]): KeywordSection[] {
  const buckets = new Map<string, Keyword[]>();

  for (const keyword of keywords) {
    const key = getGroupKey(keyword.name);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(keyword);
  }

  return SECTION_ORDER.map((key) => ({
    key,
    items: (buckets.get(key) || [])
      .slice()
      .sort((a, b) => compareWithinGroup(key, a.name, b.name)),
  })).filter((section) => section.items.length > 0);
}
