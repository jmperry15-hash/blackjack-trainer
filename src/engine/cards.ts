// Cards, shoe and hand evaluation.

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  id: number;
  rank: Rank;
  suit: Suit;
}

export const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
export const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export const NUM_DECKS = 6;
/** Reshuffle once this fraction of the shoe has been dealt (cut card). */
export const PENETRATION = 0.75;

/** Blackjack value of a card: Ace = 1 here (soft handling is done by handValue), faces = 10. */
export function cardValue(c: Card | Rank): number {
  const r = typeof c === "string" ? c : c.rank;
  if (r === "A") return 1;
  if (r === "J" || r === "Q" || r === "K") return 10;
  return Number(r);
}

export function isRed(s: Suit) {
  return s === "♥" || s === "♦";
}

let nextId = 1;

function randomInt(max: number): number {
  // Unbiased random integer in [0, max) using crypto where available.
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && c.getRandomValues) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    let x: number;
    do {
      c.getRandomValues(buf);
      x = buf[0];
    } while (x >= limit);
    return x % max;
  }
  return Math.floor(Math.random() * max);
}

export function buildShoe(decks = NUM_DECKS): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++)
    for (const s of SUITS) for (const r of RANKS) cards.push({ id: nextId++, rank: r, suit: s });
  // Fisher–Yates shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export interface HandValue {
  total: number;
  /** True when an ace is being counted as 11. */
  soft: boolean;
}

export function handValue(cards: (Card | Rank)[]): HandValue {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const v = cardValue(c);
    total += v;
    if (v === 1) aces++;
  }
  if (aces > 0 && total + 10 <= 21) return { total: total + 10, soft: true };
  return { total, soft: false };
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

export function isPair(cards: Card[]): boolean {
  return cards.length === 2 && cardValue(cards[0]) === cardValue(cards[1]);
}

/** Dealer upcard as a strategy index: 2..10, 11 = Ace. */
export function upIndex(c: Card): number {
  const v = cardValue(c);
  return v === 1 ? 11 : v;
}

export function upLabel(up: number): string {
  return up === 11 ? "A" : String(up);
}
