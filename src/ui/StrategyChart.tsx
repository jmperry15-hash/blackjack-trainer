import React from "react";
import { Code, HARD, SOFT, UPCARDS, col, pairCode } from "../engine/strategy";
import { upLabel } from "../engine/cards";
import { dealerBust } from "../engine/odds";
import { pct } from "../engine/explain";

export interface Highlight {
  kind: "hard" | "soft" | "pair";
  rowKey: number;
  up: number;
}

const CODE_TEXT: Record<Code, string> = { H: "H", S: "S", D: "D", Ds: "Ds", P: "P" };

function Table({
  title,
  rows,
  kind,
  hl,
}: {
  title: string;
  rows: { key: number; label: string; codes: Code[] }[];
  kind: Highlight["kind"];
  hl?: Highlight | null;
}) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 font-display text-lg text-brasssoft">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-[2px] text-center text-[0.78rem] tnum">
          <thead>
            <tr>
              <th className="label px-1 text-left">You</th>
              {UPCARDS.map((u) => (
                <th
                  key={u}
                  className={`px-1 py-1 text-sm font-semibold ${hl && hl.up === u ? "text-brass" : "text-muted"}`}
                >
                  {upLabel(u)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th
                  className={`whitespace-nowrap px-1 text-left font-mono text-[0.75rem] ${
                    hl && hl.kind === kind && hl.rowKey === r.key ? "text-brass" : "text-muted"
                  }`}
                >
                  {r.label}
                </th>
                {r.codes.map((c, i) => {
                  const on = hl && hl.kind === kind && hl.rowKey === r.key && col(hl.up) === i;
                  return (
                    <td
                      key={i}
                      className={`cell-${c} h-7 min-w-[1.7rem] rounded-[3px] font-semibold ${
                        on ? "outline outline-2 outline-offset-1 outline-brass" : ""
                      }`}
                    >
                      {CODE_TEXT[c]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StrategyChart({ hl }: { hl?: Highlight | null }) {
  const hard = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((t) => ({
    key: t,
    label: t === 8 ? "5–8" : t === 17 ? "17+" : String(t),
    codes: HARD[t],
  }));
  const softRows = [13, 14, 15, 16, 17, 18, 19, 20].map((t) => ({
    key: t,
    label: `A,${t - 11}`,
    codes: SOFT[t],
  }));
  const pairs = [1, 10, 9, 8, 7, 6, 5, 4, 3, 2].map((v) => ({
    key: v,
    label: v === 1 ? "A,A" : `${v},${v}`,
    codes: UPCARDS.map((u) => pairCode(v, u)),
  }));
  // Map highlight of hard totals 5–8 and 17–21 to the collapsed chart rows.
  const mapped: Highlight | null | undefined = hl
    ? {
        ...hl,
        rowKey:
          hl.kind === "hard"
            ? Math.max(8, Math.min(17, hl.rowKey))
            : hl.kind === "soft"
              ? Math.max(13, Math.min(20, hl.rowKey))
              : hl.rowKey,
      }
    : hl;
  // Soft 12 (A,A that can't be split) and soft 21 aren't separate chart rows.
  const softHl = mapped && mapped.kind === "soft" && (hl!.rowKey < 13 || hl!.rowKey > 20) ? null : mapped;
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <Legend c="H" t="Hit" />
        <Legend c="S" t="Stand" />
        <Legend c="D" t="Double (hit if you can't)" />
        <Legend c="Ds" t="Double (stand if you can't)" />
        <Legend c="P" t="Split" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Table title="Hard totals" rows={hard} kind="hard" hl={mapped} />
        <Table title="Soft totals" rows={softRows} kind="soft" hl={softHl} />
        <Table title="Pairs" rows={pairs} kind="pair" hl={mapped} />
      </div>
      <div className="min-w-0">
        <div className="label mb-2">Dealer bust chance by upcard (calculated, after peek)</div>
        <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
          {UPCARDS.map((u) => (
            <div key={u} className="rounded border border-line bg-panel px-1 py-1.5 text-center">
              <div className="text-sm font-semibold">{upLabel(u)}</div>
              <div className={`font-mono text-[0.72rem] tnum ${u <= 6 ? "text-good" : "text-muted"}`}>{pct(dealerBust(u))}</div>
            </div>
          ))}
        </div>
      </div>
      <p className="max-w-prose text-xs leading-relaxed text-muted">
        Rules: 6 decks, dealer stands on soft 17, blackjack pays 3:2, double on any first two cards, double after split,
        re-split to 4 hands (aces once, one card each), no surrender, no insurance offered (basic strategy never takes it).
        Chart is the standard 4–8 deck S17/DAS basic strategy, cross-checked against this app's EV engine.
      </p>
    </div>
  );
}

function Legend({ c, t }: { c: Code; t: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`cell-${c} inline-grid h-5 w-6 place-items-center rounded-[3px] text-[0.7rem] font-bold`}>{c}</span>
      {t}
    </span>
  );
}
