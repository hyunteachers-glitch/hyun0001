{mode === "episode" && (
  <div className="mb-8 max-w-[720px] flex flex-col gap-3">
    <div className="relative">
      <input
        value={webtoonSearch}
        onChange={(e) => {
          setWebtoonSearch(e.target.value);
          setSelectedWebtoonId("");
        }}
        placeholder="작품 검색"
        className={inputClass}
      />

      <div className="absolute left-0 right-0 top-[100%] mt-2 bg-black border border-white/15 rounded-2xl overflow-hidden max-h-[280px] overflow-y-auto z-50">
        {(webtoonSearch.trim() === ""
          ? webtoons
          : webtoons.filter((toon) =>
              toon.title
                .toLowerCase()
                .includes(webtoonSearch.toLowerCase())
            )
        ).map((toon) => (
          <button
            key={toon.id}
            onClick={() => {
              setSelectedWebtoonId(String(toon.id));
              setWebtoonSearch(toon.title);
            }}
            className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white hover:text-black transition ${
              selectedWebtoonId === String(toon.id)
                ? "bg-white text-black"
                : "bg-black text-white"
            }`}
          >
            {toon.title}
          </button>
        ))}
      </div>
    </div>

    <input
      value={episodeTitle}
      onChange={(e) => setEpisodeTitle(e.target.value)}
      placeholder="에피소드 제목"
      className={inputClass}
    />

    <div className="flex gap-3 flex-wrap">
      <button onClick={createEpisode} className={buttonClass}>
        에피소드 만들기
      </button>

      <button
        onClick={() => {
          setRangeMode(!rangeMode);
          setRangeStartId(null);
        }}
        className={rangeMode ? activeButtonClass : buttonClass}
      >
        {rangeMode ? "범위선택 중" : "범위선택"}
      </button>
    </div>
  </div>
)}