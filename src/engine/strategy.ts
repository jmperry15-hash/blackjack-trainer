// Basic strategy for: 6 decks, dealer stands on soft 17 (S17), double on any two
// cards, double after split (DAS), no surrender, dealer peeks for blackjack.
// Source chart: the standard published 4–8 deck S17 DAS basic strategy
// (e.g. Wizard of Odds). It is cross-checked against the EV engine in
// scripts/verify.mjs.

import { Card, handValue, isPair, cardValue } from "./cards";

export type Action = "hit" | "stand" | "double" | "split";
/** Chart codes. D = double if allowed else hit; Ds = double if allowed else stand. */
export type Code = "H" | "S" | "D" | "Ds" | "P";

export const UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

const row = (s: string): Code[] => s.trim().split(/\s+/) as Code[];

/** Hard totals 5..21 (index by total). Columns: dealer 2..A. */
export const HARD: Record<number, Code[]> = {
  5: row("H H H H H H H H H H"),
  6: row("H H H H H H H H H H"),
  7: row("H H H H H H H H H H"),
  8: row("H H H H H H H H H H"),
  9: row("H D D D D H H H H H"),
  10: row("D D D D D D D D H H"),
  11: row("D D D D D D D D D H"),
  12: row("H H S S S H H H H H"),
  13: row("S S S S S H H H H H"),
  14: row("S S S S S H H H H H"),
  15: row("S S S S S H H H H H"),
  16: row("S S S S S H H H H H"),
  17: row("S S S S S S S S S S"),
  18: row("S S S S S S S S S S"),
  19: row("S S S S S S S S S S"),
  20: row("S S S S S S S S S S"),
  21: row("S S S S S S S S S S"),
};

/** Soft totals 13..21 (A2..A9 plus soft 21). */
export const SOFT: Record<number, Code[]> = {
  12: row("H H H H H H H H H H"), // A,A when it can no longer be split
  13: row("H H H D D H H H H H"),
  14: row("H H H D D H H H H H"),
  15: row("H H D D D H H H H H"),
  16: row("H H D D D H H H H H"),
  17: row("H D D D D H H H H H"),
  18: row("S Ds Ds Ds Ds S S H H H"),
  19: row("S S S S S S S S S S"),
  20: row("S S S S S S S S S S"),
  21: row("S S S S S S S S S S"),
};

/** Pairs, keyed by card value (1 = aces). true = split. DAS rules. */
export const PAIR_SPLIT: Record<number, boolean[]> = {
  1: [true, true, true, true, true, true, true, true, true, true],
  2: [true, true, true, true, true, true, false, false, false, false],
  3: [true, true, true, true, true, true, false, false, false, false],
  4: [false, false, false, true, true, false, false, false, false, false],
  5: [false, false, false, false, false, false, false, false, false, false],
  6: [true, true, true, true, true, false, false, false, false, false],
  7: [true, true, true, true, true, true, false, false, false, false],
  8: [true, true, true, true, true, true, true, true, true, true],
  9: [true, true, true, true, true, false, true, true, false, false],
  10: [false, false, false, false, false, false, false, false, false, false],
};

export const col = (up: number) => up - 2; // 2..11 -> 0..9

export type HandKind = "hard" | "soft" | "pair";

export interface Recommendation {
  action: Action;
  code: Code;
  kind: HandKind;
  /** Chart row key: total for hard/soft, card value for pairs. */
  rowKey: number;
  total: number;
  soft: boolean;
}

export interface DecisionContext {
  cards: Card[];
  up: number; // 2..11
  canDouble: boolean;
  canSplit: boolean;
}

export function totalCode(total: number, soft: boolean, up: number): Code {
  if (soft) {
    const r = SOFT[Math.max(12, Math.min(21, total))];
    return r[col(up)];
  }
  if (total <= 5) return "H";
  if (total >= 21) return "S";
  return HARD[total][col(up)];
}

export function resolve(code: Code, canDouble: boolean): Action {
  switch (code) {
    case "H":
      return "hit";
    case "S":
      return "stand";
    case "D":
      return canDouble ? "double" : "hit";
    case "Ds":
      return canDouble ? "double" : "stand";
    case "P":
      return "split";
  }
}

export function recommend(ctx: DecisionContext): Recommendation {
  const { total, soft } = handValue(ctx.cards);
  if (isPair(ctx.cards) && ctx.canSplit) {
    const v = cardValue(ctx.cards[0]);
    if (PAIR_SPLIT[v][col(ctx.up)]) {
      return { action: "split", code: "P", kind: "pair", rowKey: v, total, soft };
    }
    const code = totalCode(total, soft, ctx.up);
    return { action: resolve(code, ctx.canDouble), code, kind: "pair", rowKey: v, total, soft };
  }
  const code = totalCode(total, soft, ctx.up);
  return {
    action: resolve(code, ctx.canDouble),
    code,
    kind: soft ? "soft" : "hard",
    rowKey: Math.min(total, 21),
    total,
    soft,
  };
}

/** Chart cell code for a pair row (P or the total-based fallback). */
export function pairCode(v: number, up: number): Code {
  if (PAIR_SPLIT[v][col(up)]) return "P";
  if (v === 1) return totalCode(12, true, up);
  return totalCode(v * 2, false, up);
}
