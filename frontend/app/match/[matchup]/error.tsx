"use client";

import { useEffect } from "react";

export default function MatchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Match page error:", error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#030A06",
        color: "#C8D6C8",
        fontFamily: "monospace",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        gap: 16,
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#FF3366" }}>
        MATCH PAGE ERROR
      </div>
      <pre
        style={{
          background: "rgba(255,51,102,0.06)",
          border: "1px solid rgba(255,51,102,0.2)",
          borderRadius: 6,
          padding: 20,
          fontSize: 12,
          color: "rgba(255,100,100,0.9)",
          maxWidth: 700,
          width: "100%",
          overflowX: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {error.name}: {error.message}
        {"\n\n"}
        {error.stack}
      </pre>
      <button
        onClick={reset}
        style={{
          background: "none",
          border: "1px solid #122518",
          color: "#5A7A5A",
          cursor: "pointer",
          padding: "6px 16px",
          fontSize: 11,
          letterSpacing: "0.12em",
          borderRadius: 3,
        }}
      >
        RETRY
      </button>
    </main>
  );
}
