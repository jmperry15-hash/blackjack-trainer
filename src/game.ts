import {
  Card,
  buildShoe,
  cardValue,
  handValue,
  isBlackjack,
  isPair,
  upIndex,
  NUM_DECKS,
  PENETRATION,
} from "./engine/cards";
import { Action, HandKind, recommend, Recommendation } from "./engine/strategy";
import { actionEVs, ActionEVs, actionOutcomes, MAX_HANDS } from "./engine/odds";
import { evCost, explain, winImpact, WinImpact } from "./engine/explain";

export type Mode = "learn" | "test";
export type Outcome = "blackjack" | "win" | "push" | "lose" | "bust";
export type Phase = "idle" | "player" | "dealer" | "over";

export interface PlayerHand {
  cards: Card[];
  bet: number;
  doubled: boolean;
  fromSplit: boolean;
  splitAces: boolean;
  done: boolean;
  outcome?: Outcome;
  net?: number;
}

export interface Decision {
  id: string;
  ts: number;
  cards: string[];
  up: number;
  choice: Action;
  optimal: Action;
  correct: boolean;
  kind: HandKind;
  total: number;
  soft: boolean;
  costPer100: number | null;
  /** Win-chance comparison (missing on decisions saved by older versions). */
  win?: WinImpact | null;
  headline: string;
  reasons: string[];
}

export interface Session {
  id: string;
  mode: Mode;
  startedAt: number;
  rounds: number;
  wins: number;
  losses: number;
  pushes: number;
  blackjacks: number;
  net: number;
  decisions: Decision[];
}

export interface GameState {
  shoe: Card[];
  shuffledNotice: boolean;
  dealer: Card[];
  holeHidden: boolean;
  hands: PlayerHand[];
  active: number;
  phase: Phase;
  note: string | null;
  bet: number;
  bankroll: number;
  lastDecision: Decision | null;
  roundNet: number | null;
}

export const SHOE_SIZE = NUM_DECKS * 52;
export const START_BANKROLL = 1000;

export function newSession(mode: Mode): Session {
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    mode,
    startedAt: Date.now(),
    rounds: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    blackjacks: 0,
    net: 0,
    decisions: [],
  };
}

export function initialGame(bet = 10, bankroll = START_BANKROLL): GameState {
  return {
    shoe: buildShoe(),
    shuffledNotice: false,
    dealer: [],
    holeHidden: true,
    hands: [],
    active: 0,
    phase: "idle",
    note: null,
    bet,
    bankroll,
    lastDecision: null,
    roundNet: null,
  };
}

function draw(g: GameState): Card {
  const c = g.shoe[g.shoe.length - 1];
  g.shoe = g.shoe.slice(0, -1);
  return c;
}

export const dealerUp = (g: GameState) => (g.dealer[0] ? upIndex(g.dealer[0]) : 0);

export interface DecisionInfo {
  canDouble: boolean;
  canSplit: boolean;
  rec: Recommendation;
  evs: ActionEVs;
}

/** Everything the coach needs for the active hand's current decision. */
export function decisionInfo(g: GameState): DecisionInfo | null {
  if (g.phase !== "player") return null;
  const h = g.hands[g.active];
  if (!h || h.done) return null;
  const up = dealerUp(g);
  const canDouble = h.cards.length === 2 && !h.splitAces;
  const canSplit = isPair(h.cards) && g.hands.length < MAX_HANDS && !h.splitAces;
  const rec = recommend({ cards: h.cards, up, canDouble, canSplit });
  const { total, soft } = handValue(h.cards);
  const evs = actionEVs({ total, soft }, up, {
    canDouble,
    splitValue: canSplit ? cardValue(h.cards[0]) : undefined,
  });
  return { canDouble, canSplit, rec, evs };
}

export function pairLabel(cards: Card[]): string | undefined {
  if (!isPair(cards)) return undefined;
  const v = cardValue(cards[0]);
  return v === 1 ? "A" : String(v);
}

export function explainCurrent(g: GameState, info: DecisionInfo) {
  const h = g.hands[g.active];
  return explain(info.rec, dealerUp(g), info.evs, {
    canDouble: info.canDouble,
    pairLabel: info.canSplit || info.rec.kind === "pair" ? pairLabel(h.cards) : undefined,
    cardCount: h.cards.length,
  });
}

// ---------------------------------------------------------------- dealing

export function deal(prev: GameState): GameState {
  const g: GameState = { ...prev, hands: [], dealer: [], lastDecision: null, roundNet: null, note: null };
  g.shuffledNotice = false;
  if (g.shoe.length < SHOE_SIZE * (1 - PENETRATION)) {
    g.shoe = buildShoe();
    g.shuffledNotice = true;
  }
  const p1 = draw(g);
  const d1 = draw(g);
  const p2 = draw(g);
  const d2 = draw(g);
  g.dealer = [d1, d2];
  g.holeHidden = true;
  g.hands = [{ cards: [p1, p2], bet: g.bet, doubled: false, fromSplit: false, splitAces: false, done: false }];
  g.active = 0;
  const up = upIndex(d1);
  const dealerBJ = isBlackjack(g.dealer);
  const playerBJ = isBlackjack(g.hands[0].cards);
  const peeks = up === 11 || up === 10;
  if (dealerBJ) {
    g.holeHidden = false;
    g.note = playerBJ ? "Both have blackjack. Push." : "Dealer peeks and has blackjack.";
    return settle(g);
  }
  if (playerBJ) {
    g.holeHidden = false;
    g.note = "Blackjack! Pays 3 to 2.";
    return settle(g);
  }
  g.phase = "player";
  if (peeks) g.note = "Dealer peeked: no blackjack.";
  return g;
}

function nextHand(g: GameState): GameState {
  const idx = g.hands.findIndex((h) => !h.done);
  if (idx >= 0) {
    g.active = idx;
    return g;
  }
  const allBust = g.hands.every((h) => handValue(h.cards).total > 21);
  if (allBust) {
    g.holeHidden = false;
    return settle(g);
  }
  g.phase = "dealer";
  return g;
}

function autoDone(h: PlayerHand) {
  const v = handValue(h.cards).total;
  if (v >= 21) h.done = true;
}

export interface ActResult {
  game: GameState;
  decision: Decision | null;
}

export function act(prev: GameState, action: Action): ActResult {
  const info = decisionInfo(prev);
  if (!info) return { game: prev, decision: null };
  if (action === "double" && !info.canDouble) return { game: prev, decision: null };
  if (action === "split" && !info.canSplit) return { game: prev, decision: null };

  const hand = prev.hands[prev.active];
  const up = dealerUp(prev);
  const ex = explainCurrent(prev, info);
  const optimal = info.rec.action;
  const decision: Decision = {
    id: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    cards: hand.cards.map((c) => c.rank),
    up,
    choice: action,
    optimal,
    correct: action === optimal,
    kind: info.rec.kind,
    total: info.rec.total,
    soft: info.rec.soft,
    costPer100: action === optimal ? 0 : (() => {
      const c = evCost(info.evs, action, optimal, info.rec, up, hand.cards.length);
      return c === null ? null : c * 100;
    })(),
    win:
      action === optimal
        ? null
        : winImpact(
            action,
            optimal,
            actionOutcomes({ total: info.rec.total, soft: info.rec.soft }, up, {
              canDouble: info.canDouble,
              splitValue: info.canSplit ? cardValue(hand.cards[0]) : undefined,
            }),
          ),
    headline: ex.headline,
    reasons: ex.reasons,
  };

  const g: GameState = { ...prev, hands: prev.hands.map((h) => ({ ...h, cards: [...h.cards] })), lastDecision: decision };
  const h = g.hands[g.active];
  if (action === "hit") {
    h.cards.push(draw(g));
    autoDone(h);
  } else if (action === "stand") {
    h.done = true;
  } else if (action === "double") {
    h.bet *= 2;
    h.doubled = true;
    h.cards.push(draw(g));
    h.done = true;
  } else if (action === "split") {
    const aces = cardValue(h.cards[0]) === 1;
    const a: PlayerHand = { cards: [h.cards[0], draw(g)], bet: h.bet, doubled: false, fromSplit: true, splitAces: aces, done: aces };
    const b: PlayerHand = { cards: [h.cards[1], draw(g)], bet: h.bet, doubled: false, fromSplit: true, splitAces: aces, done: aces };
    autoDone(a);
    autoDone(b);
    g.hands.splice(g.active, 1, a, b);
  }
  return { game: nextHand(g), decision };
}

export function dealerStep(prev: GameState): GameState {
  if (prev.phase !== "dealer") return prev;
  const g: GameState = { ...prev, dealer: [...prev.dealer] };
  if (g.holeHidden) {
    g.holeHidden = false;
    return g;
  }
  if (handValue(g.dealer).total < 17) {
    g.dealer.push(draw(g));
    return g;
  }
  return settle(g);
}

export function settle(prev: GameState): GameState {
  const g: GameState = { ...prev, hands: prev.hands.map((h) => ({ ...h })) };
  const dv = handValue(g.dealer).total;
  const dealerBJ = isBlackjack(g.dealer);
  let net = 0;
  for (const h of g.hands) {
    const pv = handValue(h.cards).total;
    const natural = !h.fromSplit && isBlackjack(h.cards);
    if (pv > 21) {
      h.outcome = "bust";
      h.net = -h.bet;
    } else if (dealerBJ) {
      h.outcome = natural ? "push" : "lose";
      h.net = natural ? 0 : -h.bet;
    } else if (natural) {
      h.outcome = "blackjack";
      h.net = h.bet * 1.5;
    } else if (dv > 21 || pv > dv) {
      h.outcome = "win";
      h.net = h.bet;
    } else if (pv === dv) {
      h.outcome = "push";
      h.net = 0;
    } else {
      h.outcome = "lose";
      h.net = -h.bet;
    }
    h.done = true;
    net += h.net;
  }
  g.phase = "over";
  g.roundNet = net;
  g.bankroll += net;
  return g;
}

export function applyRoundToSession(s: Session, g: GameState): Session {
  const n = { ...s, rounds: s.rounds + 1 };
  for (const h of g.hands) {
    if (h.outcome === "win" || h.outcome === "blackjack") n.wins++;
    else if (h.outcome === "push") n.pushes++;
    else n.losses++;
    if (h.outcome === "blackjack") n.blackjacks++;
  }
  n.net += g.roundNet ?? 0;
  return n;
}
