import { supabase } from "@/lib/supabase/client";
import type { Keyword, Webtoon } from "@/lib/types";
import { normalizeTitleForCompare } from "@/lib/title";

// 이 파일의 함수들은 실패 시 에러를 alert하지 않고 그대로 throw한다.
// 호출하는 쪽(페이지/컴포넌트)에서 try/catch로 잡아서 처리한다.

export async function listKeywords(): Promise<Keyword[]> {
  const { data, error } = await supabase
    .from("keywords")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;

  return data || [];
}

export async function getKeywordByName(name: string): Promise<Keyword | null> {
  const { data, error } = await supabase
    .from("keywords")
    .select("*")
    .ilike("name", name.trim())
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function getWebtoonsByKeyword(keywordId: number): Promise<Webtoon[]> {
  const { data, error } = await supabase
    .from("webtoons")
    .select("*, webtoon_keywords!inner(keyword_id)")
    .eq("webtoon_keywords.keyword_id", keywordId)
    .eq("deleted", false)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return ((data || []) as (Webtoon & { webtoon_keywords: unknown[] })[]).map(
    ({ webtoon_keywords, ...webtoon }) => webtoon
  );
}

export async function getKeywordsForWebtoon(webtoonId: number): Promise<Keyword[]> {
  const { data, error } = await supabase
    .from("webtoon_keywords")
    .select("keywords(*)")
    .eq("webtoon_id", webtoonId)
    .order("name", { foreignTable: "keywords", ascending: true });

  if (error) throw error;

  return ((data || []) as unknown as { keywords: Keyword | null }[])
    .map((row) => row.keywords)
    .filter((keyword): keyword is Keyword => !!keyword);
}

export async function getOrCreateKeyword(name: string): Promise<Keyword> {
  const trimmed = name.trim().replace(/^#+/, "").trim();

  if (!trimmed) {
    throw new Error("키워드를 입력해줘.");
  }

  const existing = await getKeywordByName(trimmed);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("keywords")
    .insert({ name: trimmed })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const fallback = await getKeywordByName(trimmed);
      if (fallback) return fallback;
    }

    throw error;
  }

  return data as Keyword;
}

export async function addKeywordToWebtoon(
  webtoonId: number,
  keywordId: number
): Promise<void> {
  const { error } = await supabase.from("webtoon_keywords").upsert(
    { webtoon_id: webtoonId, keyword_id: keywordId },
    { onConflict: "webtoon_id,keyword_id", ignoreDuplicates: true }
  );

  if (error) throw error;
}

export async function removeKeywordFromWebtoon(
  webtoonId: number,
  keywordId: number
): Promise<void> {
  const { error } = await supabase
    .from("webtoon_keywords")
    .delete()
    .eq("webtoon_id", webtoonId)
    .eq("keyword_id", keywordId);

  if (error) throw error;
}

export async function renameKeyword(keywordId: number, name: string): Promise<Keyword> {
  const trimmed = name.trim().replace(/^#+/, "").trim();

  if (!trimmed) {
    throw new Error("카테고리 이름을 입력해줘.");
  }

  const existing = await getKeywordByName(trimmed);
  if (existing && existing.id !== keywordId) {
    throw new Error("이미 있는 카테고리야.");
  }

  const { data, error } = await supabase
    .from("keywords")
    .update({ name: trimmed })
    .eq("id", keywordId)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("이미 있는 카테고리야.");
    }

    throw error;
  }

  return data as Keyword;
}

export type WebtoonTitleMatch = Pick<Webtoon, "id" | "title" | "deleted">;

// 정리·정규화한 제목이 같은 작품을 DB에서 찾는다. 없으면 null.
// 연속 공백/대소문자 무시 비교는 SQL로 하기 번거로워서 제목 목록을 받아와 클라이언트에서 비교한다.
export async function findWebtoonByTitle(
  title: string,
  options: { includeDeleted?: boolean; excludeId?: number } = {}
): Promise<WebtoonTitleMatch | null> {
  const target = normalizeTitleForCompare(title);
  if (!target) return null;

  let query = supabase.from("webtoons").select("id,title,deleted");
  if (!options.includeDeleted) query = query.eq("deleted", false);

  const { data, error } = await query;
  if (error) throw error;

  return (
    ((data || []) as WebtoonTitleMatch[]).find(
      (toon) =>
        toon.id !== options.excludeId &&
        normalizeTitleForCompare(toon.title || "") === target
    ) ?? null
  );
}

export async function deleteKeyword(keywordId: number): Promise<void> {
  const { error } = await supabase.from("keywords").delete().eq("id", keywordId);

  if (error) throw error;
}

export async function getActiveWorkCountForKeyword(keywordId: number): Promise<number> {
  const { count, error } = await supabase
    .from("webtoon_keywords")
    .select("webtoon_id, webtoons!inner(deleted)", { count: "exact", head: true })
    .eq("keyword_id", keywordId)
    .eq("webtoons.deleted", false);

  if (error) throw error;

  return count ?? 0;
}

export async function deleteKeywordIfEmpty(keywordId: number): Promise<void> {
  const activeCount = await getActiveWorkCountForKeyword(keywordId);
  if (activeCount > 0) return;

  const { error: linksError } = await supabase
    .from("webtoon_keywords")
    .delete()
    .eq("keyword_id", keywordId);

  if (linksError) throw linksError;

  await deleteKeyword(keywordId);
}
