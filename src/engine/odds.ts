// Exact probability / expected-value engine.
//
// Model: card draws use full 6-deck shoe frequencies (A–9 = 1/13 each, ten-values
// = 4/13). This "infinite deck" model is the standard way basic strategy is
// derived and taught; it differs from a real 6-deck shoe by only a few
// hundredths of a percent. Dealer probabilities are conditioned on the dealer
// NOT having blackjack, because the dealer peeks with an A or 10 showing and
// the hand would already be over otherwise. Dealer stands on all 17s.

export const P: number[] = [0, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 4 / 13];
// index 1 = ace, 2..9, 10 = any ten-value card

export interface State {
  total: number;
  soft: boolean;
}

export function addCard(s: State, v: number): State {
  if (v === 1) {
    if (s.total + 11 <= 21) return { total: s.total + 11, soft: true };
    return { total: s.total + 1, soft: s.soft };
  }
  const t = s.total + v;
  if (t > 21 && s.soft) return { total: t - 10, soft: false };
  return { total: t, soft: s.soft };
}

/** Final dealer distribution: index 0..4 = 17..21, 5 = bust. */
export type DealerDist = number[];

const dealerMemo = new Map<string, DealerDist>();

function dealerFrom(s: State): DealerDist {
  if (s.total > 21) return [0, 0, 0, 0, 0, 1];
  if (s.total >= 17) {
    const d = [0, 0, 0, 0, 0, 0];
    d[s.total - 17] = 1;
    return d;
  }
  const key = `${s.total}${s.soft ? "s" : "h"}`;
  const m = dealerMemo.get(key);
  if (m) return m;
  const out = [0, 0, 0, 0, 0, 0];
  for (let v = 1; v <= 10; v++) {
    const sub = dealerFrom(addCard(s, v));
    for (let i = 0; i < 6; i++) out[i] += P[v] * sub[i];
  }
  dealerMemo.set(key, out);
  return out;
}

const upStart = (up: number): State => (up === 11 ? { total: 11, soft: true } : { total: up, soft: false });

const distCache = new Map<number, DealerDist>();

/** Dealer final-total distribution for an upcard (2..11), given no dealer blackjack. */
export function dealerDistribution(up: number): DealerDist {
  const c = distCache.get(up);
  if (c) return c;
  const start = upStart(up);
  const out = [0, 0, 0, 0, 0, 0];
  let norm = 0;
  for (let v = 1; v <= 10; v++) {
    // Exclude the hole card that would complete a blackjack (dealer peeked).
    if (up === 11 && v === 10) continue;
    if (up === 10 && v === 1) continue;
    norm += P[v];
    const sub = dealerFrom(addCard(start, v));
    for (let i = 0; i < 6; i++) out[i] += P[v] * sub[i];
  }
  for (let i = 0; i < 6; i++) out[i] /= norm;
  distCache.set(up, out);
  return out;
}

export function dealerBust(up: number): number {
  return dealerDistribution(up)[5];
}

/** Probability that the next card busts a hand with this state. */
export function bustOnNextCard(s: State): number {
  let p = 0;
  for (let v = 1; v <= 10; v++) if (addCard(s, v).total > 21) p += P[v];
  return p;
}

export function standEV(total: number, up: number): number {
  if (total > 21) return -1;
  const d = dealerDistribution(up);
  let ev = d[5];
  for (let i = 0; i < 5; i++) {
    const dt = 17 + i;
    if (total > dt) ev += d[i];
    else if (total < dt) ev -= d[i];
  }
  return ev;
}

const hitMemo = new Map<string, number>();

/** EV of hitting now and then playing optimally (hit/stand only) afterwards. */
export function hitEV(s: State, up: number): number {
  const key = `${up}:${s.total}${s.soft ? "s" : "h"}`;
  const m = hitMemo.get(key);
  if (m !== undefined) return m;
  let ev = 0;
  for (let v = 1; v <= 10; v++) {
    const n = addCard(s, v);
    if (n.total > 21) ev -= P[v];
    else ev += P[v] * Math.max(standEV(n.total, up), n.total >= 21 ? -Infinity : hitEV(n, up));
  }
  hitMemo.set(key, ev);
  return ev;
}

export function doubleEV(s: State, up: number): number {
  let ev = 0;
  for (let v = 1; v <= 10; v++) ev += P[v] * 2 * standEV(addCard(s, v).total, up);
  return ev;
}

/** Best EV of a two-card hand without splitting. */
function bestNoSplit(s: State, up: number, canDouble: boolean): number {
  let best = Math.max(standEV(s.total, up), hitEV(s, up));
  if (canDouble) best = Math.max(best, doubleEV(s, up));
  return best;
}

export const MAX_HANDS = 4;

/**
 * EV of splitting a pair of card value v (1 = aces), per original unit bet.
 * Rules: re-split up to 4 hands (not aces), double after split allowed,
 * split aces receive exactly one card each, 21 after a split is not a blackjack.
 */
export function splitEV(v: number, up: number): number {
  const first: State = v === 1 ? { total: 11, soft: true } : { total: v, soft: false };
  if (v === 1) {
    let e = 0;
    for (let c = 1; c <= 10; c++) e += P[c] * standEV(addCard(first, c).total, up);
    return 2 * e;
  }
  const q = P[v];
  // EV of one split hand given its second card is NOT another v (DAS allowed).
  let eNot = 0;
  for (let c = 1; c <= 10; c++) if (c !== v) eNot += P[c] * bestNoSplit(addCard(first, c), up, true);
  eNot /= 1 - q;
  // EV of a v,v hand that can no longer be re-split (hand limit reached).
  const ePairLocked = bestNoSplit(addCard(first, v), up, true);
  // Expected total EV over the branching re-split process, capped at MAX_HANDS.
  const memo = new Map<string, number>();
  const g = (hands: number, pending: number): number => {
    if (pending === 0) return 0;
    const k = `${hands}:${pending}`;
    const mm = memo.get(k);
    if (mm !== undefined) return mm;
    const resplit = hands < MAX_HANDS ? g(hands + 1, pending + 1) : ePairLocked + g(hands, pending - 1);
    const r = q * resplit + (1 - q) * (eNot + g(hands, pending - 1));
    memo.set(k, r);
    return r;
  };
  return g(2, 2);
}

export interface ActionEVs {
  stand: number;
  hit: number;
  double?: number;
  split?: number;
}

export function actionEVs(
  s: State,
  up: number,
  opts: { canDouble: boolean; splitValue?: number; splitAcesOnly?: boolean },
): ActionEVs {
  const out: ActionEVs = {
    stand: standEV(s.total, up),
    hit: s.total >= 21 ? -1 : hitEV(s, up),
  };
  if (opts.canDouble) out.double = doubleEV(s, up);
  if (opts.splitValue !== undefined) out.split = splitEV(opts.splitValue, up);
  return out;
}

/** Probability that the dealer finishes on a total that beats `total` (no bust). */
export function dealerBeats(total: number, up: number): number {
  const d = dealerDistribution(up);
  let p = 0;
  for (let i = 0; i < 5; i++) if (17 + i > total) p += d[i];
  return p;
}

/** Probability that a single drawn card is a ten-value. */
export const P_TEN = 4 / 13;

// ---------------------------------------------------------------- win / push / lose

/** Probabilities that a hand ends as [win, push, lose], counting each hand once regardless of bet size. */
export type Outcome3 = [number, number, number];

const add3 = (a: Outcome3, b: Outcome3, w: number): Outcome3 => [a[0] + w * b[0], a[1] + w * b[1], a[2] + w * b[2]];
const LOSE: Outcome3 = [0, 0, 1];

export function standOutcome(total: number, up: number): Outcome3 {
  if (total > 21) return LOSE;
  const d = dealerDistribution(up);
  let win = d[5];
  let push = 0;
  let lose = 0;
  for (let i = 0; i < 5; i++) {
    const dt = 17 + i;
    if (total > dt) win += d[i];
    else if (total === dt) push += d[i];
    else lose += d[i];
  }
  return [win, push, lose];
}

const hitOutMemo = new Map<string, Outcome3>();

/** Outcome of hitting now, then continuing with the EV-best hit/stand play (as the book does). */
export function hitOutcome(s: State, up: number): Outcome3 {
  const key = `${up}:${s.total}${s.soft ? "s" : "h"}`;
  const m = hitOutMemo.get(key);
  if (m) return m;
  let out: Outcome3 = [0, 0, 0];
  for (let v = 1; v <= 10; v++) {
    const n = addCard(s, v);
    if (n.total > 21) out = add3(out, LOSE, P[v]);
    else if (n.total >= 21 || standEV(n.total, up) >= hitEV(n, up)) out = add3(out, standOutcome(n.total, up), P[v]);
    else out = add3(out, hitOutcome(n, up), P[v]);
  }
  hitOutMemo.set(key, out);
  return out;
}

export function doubleOutcome(s: State, up: number): Outcome3 {
  let out: Outcome3 = [0, 0, 0];
  for (let v = 1; v <= 10; v++) out = add3(out, standOutcome(addCard(s, v).total, up), P[v]);
  return out;
}

/** Outcome of the EV-best play of a two-card hand (no split). */
function bestNoSplitOutcome(s: State, up: number): Outcome3 {
  const st = standEV(s.total, up);
  const h = hitEV(s, up);
  const d = doubleEV(s, up);
  if (d > st && d > h) return doubleOutcome(s, up);
  return h > st ? hitOutcome(s, up) : standOutcome(s.total, up);
}

/** Average outcome of each hand after splitting (same rules as splitEV). */
export function splitOutcome(v: number, up: number): Outcome3 {
  const first: State = v === 1 ? { total: 11, soft: true } : { total: v, soft: false };
  if (v === 1) {
    let out: Outcome3 = [0, 0, 0];
    for (let c = 1; c <= 10; c++) out = add3(out, standOutcome(addCard(first, c).total, up), P[c]);
    return out;
  }
  const q = P[v];
  let notPair: Outcome3 = [0, 0, 0];
  for (let c = 1; c <= 10; c++) if (c !== v) notPair = add3(notPair, bestNoSplitOutcome(addCard(first, c), up), P[c] / (1 - q));
  const locked = bestNoSplitOutcome(addCard(first, v), up);
  // Expected number of finished hands of each type in the re-split process.
  const memo = new Map<string, [number, number]>();
  const g = (hands: number, pending: number): [number, number] => {
    if (pending === 0) return [0, 0];
    const k = `${hands}:${pending}`;
    const mm = memo.get(k);
    if (mm) return mm;
    let rs: [number, number];
    if (hands < MAX_HANDS) rs = g(hands + 1, pending + 1);
    else {
      const r = g(hands, pending - 1);
      rs = [r[0], r[1] + 1];
    }
    const nr = g(hands, pending - 1);
    const out: [number, number] = [q * rs[0] + (1 - q) * (nr[0] + 1), q * rs[1] + (1 - q) * nr[1]];
    memo.set(k, out);
    return out;
  };
  const [nNot, nLocked] = g(2, 2);
  const tot = nNot + nLocked;
  return add3(add3([0, 0, 0], notPair, nNot / tot), locked, nLocked / tot);
}

export type ActionOutcomes = Partial<Record<"hit" | "stand" | "double" | "split", Outcome3>>;

export function actionOutcomes(
  s: State,
  up: number,
  opts: { canDouble: boolean; splitValue?: number },
): ActionOutcomes {
  const out: ActionOutcomes = {
    stand: standOutcome(s.total, up),
    hit: s.total >= 21 ? LOSE : hitOutcome(s, up),
  };
  if (opts.canDouble) out.double = doubleOutcome(s, up);
  if (opts.splitValue !== undefined) out.split = splitOutcome(opts.splitValue, up);
  return out;
}
