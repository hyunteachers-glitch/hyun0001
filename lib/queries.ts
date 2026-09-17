import { supabase } from "@/lib/supabase/client";
import type { Keyword, Webtoon } from "@/lib/types";

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

export async function deleteKeyword(keywordId: number): Promise<void> {
  const { error } = await supabase.from("keywords").delete().eq("id", keywordId);

  if (error) throw error;
}
