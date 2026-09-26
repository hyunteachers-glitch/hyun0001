@AGENTS.md

# 진행 상황

마지막 업데이트: 2026-09-26

## 완료된 것

- **보안**: `service_role` 키 교체, RLS 정책 전체 재설계, `site_password` 서버 이전, `upload-r2` 인증 추가, 로그인 상태 UI.
- **`lib/` 구조 개선 (1~3단계)**: `env.ts`, Supabase 클라이언트 분리, `auth.ts`, `types.ts`, `keywordSort.ts` 정리 완료. **`queries.ts`는 아직 미완료.**
- **업로드**: 안정성 개선(실패 감지/재시도), 진행률 모달, 썸네일 최적화(`next/image`).
- **UI**: 아이콘 정비, 페이지네이션 컴포넌트, 검색/정렬 URL 반영 + 뒤로가기 상태 복원 버그 수정.
- **신규 기능 — 카테고리(키워드) 시스템 전체**:
  - DB 테이블/RLS, 쿼리 함수
  - 카테고리 목록 페이지(`/library/category`, 초성/영문/숫자 그룹 정렬) + 키워드별 페이지(`/library/category/[keyword]`)
  - 작품 상세 페이지 키워드 태깅 UI
  - 뒤로가기 흐름 정리: 라이브러리 → 카테고리 목록은 항상 "LIBRARY", 카테고리 목록 → 키워드 화면은 "CATEGORY", 작품 상세 → 키워드 화면은 "BACK" (모두 `from` 쿼리 파라미터로 진입 경로 추적)
- **카테고리 자동 정리**: `lib/queries.ts`에 `getActiveWorkCountForKeyword`/`deleteKeywordIfEmpty` 추가. 작품이 0개(휴지통 포함)가 된 키워드는 `keywords` 테이블에서 자동 삭제 — 트리거는 키워드 태그 제거 시 / 작품 휴지통 이동 시 / 영구삭제 시. `deleteKeywordIfEmpty`는 `keywords` 삭제 전에 `webtoon_keywords` 연결을 먼저 정리해서 FK cascade 설정 여부와 무관하게 안전하게 동작. 기존에 이미 0개였던 키워드들은 SQL로 일괄 정리 완료.
- **라이브러리 작품 제목 말줄임 처리**: `/library`, `/library/trash`, `/library/category/[keyword]` 세 곳 모두 제목에 `line-clamp-1` + `title` 속성 적용 — 1줄 초과 시 `...`로 잘리고 호버 시 전체 제목 확인 가능.
- **업로드 화면 UX 전면 개편** (`app/upload/page.tsx`):
  - 사진 그리드를 삼성 갤러리 스타일로 변경 — `gap-px` + `bg-black`으로 얇은 검은 구분선, 정사각형 썸네일(`aspect-square` + `object-cover`), 선택 표시는 `border` 대신 레이아웃에 영향 없는 `ring`으로 교체
  - 롱프레스(400ms) + 드래그 다중선택 신규 구현: 갤러리 모드 롱프레스 → 삭제 모드 진입 + 드래그로 대각선 포함 범위 선택(`getRangeItems` 재사용), 에피소드 생성 모드에도 동일하게 확장(`dragKindRef`로 delete/episode 분기, `ensureEpisodeSelected`로 이미 선택된 사진 롱프레스 시 해제 안 되게 처리)
  - 기존 2클릭 범위선택 버튼(`rangeMode`/`rangeStartId`) 완전히 제거하고 관련 코드 전부 정리
  - 드래그 중 뷰포트 가장자리 자동 스크롤(`requestAnimationFrame` 기반), 모바일 스크롤 충돌 방지(`touch-action: none` + non-passive `touchmove` preventDefault), `<Image>`에 `draggable={false}`로 브라우저 기본 이미지 드래그 충돌 해결
  - 삭제 모드 헤더 버튼 제거 → 화면 우측 하단 고정(`fixed`) 액션바로 이동. 에피소드 미리보기 화면도 동일 패턴 적용(취소/최종생성 버튼 하단 고정) + 상단 UI를 작품명 + 장수 표시로 정리
- **업로드 413 에러 해결 — presigned URL 직접 업로드로 전환**: 원인은 Vercel Function의 4.5MB 요청 바디 하드 리밋(설정으로 늘릴 수 없음). 서버 릴레이 방식이던 `app/api/upload-r2/route.ts` 삭제, `app/api/upload-r2-presign/route.ts` 신규 추가. 클라이언트가 presigned URL을 발급받아 R2에 직접 PUT하는 구조로 전환해서 서버가 파일 바이트를 더 이상 거치지 않음. Cloudflare R2 버킷 CORS 정책 추가 완료(`https://hyun0001.vercel.app`, `http://localhost:3000`).

## 다음에 할 일

- `lib/queries.ts` 마무리 — `webtoons`/`episodes`/`images` CRUD 함수 통합, 아직 미완료.
- `Card`/`gridStyle` 로직이 `library`, `trash`, `category/[keyword]` 세 곳에 중복됨 — 공용 컴포넌트/훅으로 분리 검토.
- `/login` 회원가입 제한 여부 결정 필요.
- 원래 계획했던 리팩토링 순서(`hooks/`, `components/`, `app/upload`, `viewer` 등) 계속 진행 — `app/upload/page.tsx`가 롱프레스/드래그 다중선택 로직까지 더해지며 더 커졌으니 우선순위 상향 고려.
