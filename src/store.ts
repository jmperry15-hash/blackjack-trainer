import { Action, HandKind } from "./engine/strategy";
import { Decision, Mode, Session, START_BANKROLL } from "./game";
import { upLabel } from "./engine/cards";

export interface CompactMistake {
  cards: string[];
  up: number;
  choice: Action;
  optimal: Action;
  kind: HandKind;
  total: number;
  soft: boolean;
  costPer100: number | null;
}

export interface SessionSummary {
  id: string;
  mode: Mode;
  startedAt: number;
  endedAt: number;
  rounds: number;
  decisions: number;
  correct: number;
  wins: number;
  losses: number;
  pushes: number;
  blackjacks: number;
  net: number;
  byKind: Record<HandKind, [number, number]>;
  missedByOptimal: Record<Action, number>;
  wrongChoice: Record<Action, number>;
  mistakes: CompactMistake[];
}

export interface Settings {
  hintsFirst: boolean;
  speed: "fast" | "normal";
}

export interface Persisted {
  v: 1;
  bankroll: number;
  bet: number;
  settings: Settings;
  session: Session | null;
  history: SessionSummary[];
}

const KEY = "bythebook.blackjack.v1";

export const DEFAULTS: Persisted = {
  v: 1,
  bankroll: START_BANKROLL,
  bet: 10,
  settings: { hintsFirst: true, speed: "fast" },
  session: null,
  history: [],
};

export function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Persisted;
    if (p.v !== 1) return DEFAULTS;
    return { ...DEFAULTS, ...p, settings: { ...DEFAULTS.settings, ...p.settings } };
  } catch {
    return DEFAULTS;
  }
}

export function save(p: Persisted) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: stats live for this visit only */
  }
}

const zeroActions = (): Record<Action, number> => ({ hit: 0, stand: 0, double: 0, split: 0 });

export function summarize(s: Session): SessionSummary {
  const byKind: Record<HandKind, [number, number]> = { hard: [0, 0], soft: [0, 0], pair: [0, 0] };
  const missedByOptimal = zeroActions();
  const wrongChoice = zeroActions();
  const mistakes: CompactMistake[] = [];
  let correct = 0;
  for (const d of s.decisions) {
    byKind[d.kind][1]++;
    if (d.correct) {
      correct++;
      byKind[d.kind][0]++;
    } else {
      missedByOptimal[d.optimal]++;
      wrongChoice[d.choice]++;
      mistakes.push({
        cards: d.cards,
        up: d.up,
        choice: d.choice,
        optimal: d.optimal,
        kind: d.kind,
        total: d.total,
        soft: d.soft,
        costPer100: d.costPer100,
      });
    }
  }
  return {
    id: s.id,
    mode: s.mode,
    startedAt: s.startedAt,
    endedAt: Date.now(),
    rounds: s.rounds,
    decisions: s.decisions.length,
    correct,
    wins: s.wins,
    losses: s.losses,
    pushes: s.pushes,
    blackjacks: s.blackjacks,
    net: s.net,
    byKind,
    missedByOptimal,
    wrongChoice,
    mistakes: mistakes.slice(-60),
  };
}

export function upsertHistory(history: SessionSummary[], sum: SessionSummary): SessionSummary[] {
  const i = history.findIndex((h) => h.id === sum.id);
  if (i >= 0) {
    const copy = [...history];
    copy[i] = sum;
    return copy;
  }
  return [...history, sum].slice(-200);
}

/** A label for a strategy spot, e.g. "Hard 16 v 10", "Pair 8s v A", "Soft 18 v 9". */
export function spotLabel(m: { cards: string[]; up: number; kind: HandKind; total: number; soft: boolean }): string {
  const u = upLabel(m.up);
  if (m.kind === "pair") {
    const r = ["J", "Q", "K"].includes(m.cards[0]) ? "10" : m.cards[0];
    return `Pair ${r}s v ${u}`;
  }
  return `${m.soft ? "Soft" : "Hard"} ${m.total} v ${u}`;
}

export function accuracy(correct: number, total: number) {
  return total === 0 ? null : correct / total;
}

export type { Decision };
