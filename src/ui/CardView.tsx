import React from "react";
import { Card, isRed } from "../engine/cards";

export function CardView({ card, hidden = false, delay = 0 }: { card: Card; hidden?: boolean; delay?: number }) {
  const red = isRed(card.suit);
  const face = card.rank === "J" || card.rank === "Q" || card.rank === "K";
  const label = hidden ? "Face-down card" : `${card.rank} of ${suitName(card.suit)}`;
  return (
    <div
      className={`card deal ${hidden ? "hidden-face" : ""}`}
      style={{ animationDelay: `${delay}ms` }}
      role="img"
      aria-label={label}
    >
      <div className="card-inner">
        <div className={`card-face ${red ? "red" : ""}`}>
          <div className="corner tl">
            <span>{card.rank}</span>
            <span className="s">{card.suit}</span>
          </div>
          <div className={`pip ${face ? "face" : ""}`}>
            {face ? (
              <span>
                {card.rank}
              </span>
            ) : card.rank === "A" ? (
              <span style={{ fontSize: "1.25em" }}>{card.suit}</span>
            ) : (
              card.suit
            )}
          </div>
          <div className="corner br">
            <span>{card.rank}</span>
            <span className="s">{card.suit}</span>
          </div>
        </div>
        <div className="card-back" />
      </div>
    </div>
  );
}

function suitName(s: string) {
  return s === "♠" ? "spades" : s === "♥" ? "hearts" : s === "♦" ? "diamonds" : "clubs";
}

/** Small inline card chip used in review tables, e.g. "A♠" style without suit. */
export function MiniCards({ ranks }: { ranks: string[] }) {
  return (
    <span className="inline-flex gap-1">
      {ranks.map((r, i) => (
        <span
          key={i}
          className="inline-grid h-7 w-5 place-items-center rounded-[3px] bg-ivory font-sans font-bold text-[0.72rem] tracking-tighter leading-none text-ink shadow"
        >
          {r}
        </span>
      ))}
    </span>
  );
}
