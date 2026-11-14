import React from "react";

const urlPattern = /(https?:\/\/[^\s]+)/g;
const trailingPunctuation = /[.,!?;:)\]}]+$/;

export default function LinkifiedText({ text, style = {} }) {
  const parts = String(text || "").split(urlPattern);
  return <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", ...style }}>
    {parts.map((part, index) => {
      if (!/^https?:\/\//i.test(part)) return <React.Fragment key={index}>{part}</React.Fragment>;
      const punctuation = part.match(trailingPunctuation)?.[0] || "";
      const href = punctuation ? part.slice(0, -punctuation.length) : part;
      return <React.Fragment key={index}>
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#81d4ff", textDecoration: "underline", overflowWrap: "anywhere" }}>{href}</a>
        {punctuation}
      </React.Fragment>;
    })}
  </span>;
}
