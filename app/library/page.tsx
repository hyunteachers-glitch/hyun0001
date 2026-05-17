function EpisodeLabel({ toonId }: { toonId: number }) {
  const count = episodeCounts[toonId] || 0;

  return (
    <div
      style={{
        position: "absolute",
        right: isMobile ? "6px" : "9px",
        bottom: isMobile ? "6px" : "9px",
        fontSize: isMobile ? "8px" : "12px",
        color: "rgba(255,255,255,0.55)",
      }}
    >
      {count > 0 ? `에피소드 ${count}` : "에피소드 없음"}
    </div>
  );
}

function Title({ title }: { title: string }) {
  return (
    <h2
      style={{
        fontSize: isMobile ? "9px" : "15px",
        fontWeight: "bold",
        marginTop: "5px",
        lineHeight: "1.15",
        wordBreak: "keep-all",
        paddingRight: isMobile ? "0px" : "4px",
      }}
    >
      {title}
    </h2>
  );
}

const itemsPerPage = isMobile ? 28 : 60;

const cardHeight = isMobile ? 132 : 275;