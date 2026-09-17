"use client";

import Link from "next/link";
import { X } from "lucide-react";
import type { Keyword } from "@/lib/types";

type KeywordBadgeProps = {
  keyword: Keyword;
  onRemove?: () => void;
};

const badgeClass =
  "inline-flex items-center gap-1.5 border border-white/25 rounded-full px-4 py-2 text-sm md:text-base transition";

export default function KeywordBadge({ keyword, onRemove }: KeywordBadgeProps) {
  if (onRemove) {
    return (
      <span className={`${badgeClass} text-white`}>
        #{keyword.name}
        <button
          onClick={onRemove}
          aria-label={`${keyword.name} 키워드 제거`}
          className="text-white/50 hover:text-red-400 transition"
        >
          <X size={14} />
        </button>
      </span>
    );
  }

  return (
    <Link
      href={`/library/category/${encodeURIComponent(keyword.name)}`}
      className={`${badgeClass} hover:bg-white hover:text-black`}
    >
      #{keyword.name}
    </Link>
  );
}
