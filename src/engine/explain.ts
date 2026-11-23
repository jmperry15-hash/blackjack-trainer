// Plain-language explanations built from calculated probabilities.

import { Action, Recommendation } from "./strategy";
import { ActionEVs, ActionOutcomes, Outcome3, bustOnNextCard, dealerBust, dealerDistribution, dealerBeats } from "./odds";
import { upLabel } from "./cards";

export const ACTION_LABEL: Record<Action, string> = {
  hit: "Hit",
  stand: "Stand",
  double: "Double",
  split: "Split",
};

export const pct = (p: number, d = 1) => `${(p * 100).toFixed(d)}%`;
/** EV per 100 chips wagered, signed. */
export const per100 = (ev: number) => `${ev >= 0 ? "+" : "−"}${Math.abs(ev * 100).toFixed(1)}`;

/**
 * Close calls where the infinite-deck model and an exact 6-deck calculation disagree.
 * Values were computed exactly (full 6-deck composition with the player's two cards
 * and the dealer upcard removed) by scripts/finite.ts. Per 1 unit bet.
 */
export const EXACT_6D: Record<string, { label: string; double: number; hit: number }> = {
  "soft13v5": { label: "A,2 vs 5", double: 0.13985, hit: 0.13733 },
  "soft15v4": { label: "A,4 vs 4", double: 0.06239, hit: 0.05939 },
};

export function closeCallKey(rec: Recommendation, up: number, cards: number): string | null {
  if (cards !== 2) return null;
  const k = `${rec.soft ? "soft" : "hard"}${rec.total}v${up}`;
  return EXACT_6D[k] ? k : null;
}

export function handName(rec: Recommendation, pairLabel?: string): string {
  if (rec.kind === "pair" && pairLabel) return `a pair of ${pairLabel}s`;
  if (rec.soft) return `soft ${rec.total}`;
  return `hard ${rec.total}`;
}

const weak = (up: number) => up >= 2 && up <= 6;
/** "a 6", "an 8", "an Ace" */
export const aCard = (up: number) => (up === 11 ? "an Ace" : up === 8 ? "an 8" : `a ${up}`);

export interface Explanation {
  headline: string;
  reasons: string[];
}

export function explain(
  rec: Recommendation,
  up: number,
  evs: ActionEVs,
  opts: { canDouble: boolean; pairLabel?: string; cardCount: number },
): Explanation {
  const u = upLabel(up);
  const db = dealerBust(up);
  const d = dealerDistribution(up);
  const state = { total: rec.total, soft: rec.soft };
  const bust = bustOnNextCard(state);
  const made = 1 - db;
  const reasons: string[] = [];
  const t = rec.total;
  const name = handName(rec, opts.pairLabel);
  const dealerWord = weak(up) ? "a weak card" : up === 7 || up === 8 ? "a medium-strong card" : "a strong card";

  reasons.push(
    `Dealer shows ${aCard(up)}, ${dealerWord}. From here the dealer busts ${pct(db)} of the time.`,
  );

  const a = rec.action;
  const pv = opts.pairLabel;

  if (a === "split") {
    if (pv === "A") {
      reasons.push(
        `Two aces together are only a soft 12. Split, and each ace starts fresh: any ten-value card (30.8% chance) gives that hand 21.`,
      );
    } else if (pv === "8") {
      reasons.push(
        `16 is the worst hand in blackjack. Two hands starting with 8 lose far less on average than one 16${weak(up) ? ", and against a weak card they become winners" : ", even against a strong dealer card"}.`,
      );
    } else if (pv === "9") {
      reasons.push(
        `18 is decent, but two hands starting with 9 earn more against ${aCard(up)}. (Against a 7 you'd stand: the dealer's most likely finish is 17, which 18 beats.)`,
      );
    } else if (pv === "4") {
      reasons.push(
        `Against the dealer's two weakest cards, two hands starting with 4, with the option to double after splitting, earn more than one hard 8.`,
      );
    } else {
      reasons.push(
        `A hard ${t} is a poor hand. Splitting gives you two hands that start with ${pv} while the dealer's ${u} is vulnerable, and you can double after splitting if you catch a good card.`,
      );
    }
  } else if (a === "double") {
    if (!rec.soft) {
      reasons.push(
        `A hard ${t} can't bust with one card, and a ten-value card (30.8% chance) lands you on ${t + 10}. You're the favorite here, so get twice the money in while you hold the edge.`,
      );
    } else {
      reasons.push(
        `A soft hand can't bust on one card. With the dealer this likely to bust, doubling puts more money out at the moment the dealer is weakest.`,
      );
    }
  } else if (a === "hit") {
    if (t <= 11 && !rec.soft) {
      reasons.push(`A hard ${t} can't bust with one more card (0% bust chance), so taking a card is free.`);
      if (opts.canDouble && (t === 9 || t === 10 || t === 11)) {
        reasons.push(
          `Doubling isn't worth it here: the dealer's ${u} finishes 17 or better ${pct(made)} of the time, too often to risk twice the bet on a single card.`,
        );
      }
    } else if (rec.soft) {
      reasons.push(
        `A soft ${t} can't bust on the next card, because the ace can drop back to 1. Soft ${t} is too weak to stand on against ${aCard(up)}: the dealer beats it outright ${pct(dealerBeats(t, up))} of the time.`,
      );
    } else if (t === 12 && (up === 2 || up === 3)) {
      reasons.push(
        `Only a ten-value card busts a 12 (${pct(bust)} chance). A dealer ${u} busts just ${pct(db)}, not often enough to justify standing on such a weak total.`,
      );
    } else {
      reasons.push(
        `Your ${t} only wins if the dealer busts, and against ${aCard(up)} the dealer makes 17 or better ${pct(made)} of the time. Hitting busts you ${pct(bust)} of the time, but standing loses more often.`,
      );
    }
  } else if (a === "stand") {
    if (!rec.soft && t >= 17) {
      reasons.push(`Hard ${t} is a finished hand. Another card would bust you ${pct(bust)} of the time.`);
    } else if (!rec.soft && t >= 12) {
      reasons.push(
        `Hitting would bust you ${pct(bust)} of the time. With the dealer this likely to bust, let the dealer take the risk instead.`,
      );
    } else if (rec.soft && t === 18) {
      const p17 = d[0];
      reasons.push(
        up === 7 || up === 8
          ? `Soft 18 is a winning hand against ${aCard(up)}: the dealer's most common result is 17 (${pct(p17)}), which you beat.`
          : `Soft 18 is already a solid total against ${aCard(up)}.`,
      );
    } else if (pv === "10") {
      reasons.push(`Never break up a 20. Standing on 20 wins or pushes ${pct(1 - dealerBeats(20, up))} of the time.`);
    } else {
      reasons.push(`${capitalize(name)} is a strong total. Standing keeps it.`);
    }
  }

  // Fallback note when double was the chart play but not allowed.
  if ((rec.code === "D" || rec.code === "Ds") && !opts.canDouble) {
    reasons.push(
      `The chart says double here, but you can only double on your first two cards, so the next-best play is to ${ACTION_LABEL[a].toLowerCase()}.`,
    );
  }

  const cc = closeCallKey(rec, up, opts.cardCount);
  if (cc && evs.double !== undefined) {
    const x = EXACT_6D[cc];
    reasons.push(
      `This one is very close. The simplified model nearly ties hit and double, but an exact 6-deck calculation that accounts for the cards already dealt gives Double ${per100(x.double)} vs Hit ${per100(x.hit)} per 100 chips, which is why the book says double.`,
    );
  } else {
    const best = bestOf(evs);
    const second = secondOf(evs, best);
    if (second) {
      const gap = (evs[best] as number) - (evs[second] as number);
      if (gap < 0.02) {
        reasons.push(
          `It's a close call: ${ACTION_LABEL[best as Action]} beats ${ACTION_LABEL[second as Action]} by just ${(gap * 100).toFixed(2)} chips per 100 bet. Small edges add up over thousands of hands.`,
        );
      }
    }
  }

  return { headline: `${ACTION_LABEL[a]} ${name} against ${aCard(up)}`, reasons };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function bestOf(evs: ActionEVs): keyof ActionEVs {
  let best: keyof ActionEVs = "stand";
  for (const k of ["stand", "hit", "double", "split"] as (keyof ActionEVs)[]) {
    const v = evs[k];
    if (v !== undefined && v > (evs[best] as number)) best = k;
  }
  return best;
}

function secondOf(evs: ActionEVs, best: keyof ActionEVs): keyof ActionEVs | null {
  let s: keyof ActionEVs | null = null;
  for (const k of ["stand", "hit", "double", "split"] as (keyof ActionEVs)[]) {
    if (k === best) continue;
    const v = evs[k];
    if (v !== undefined && (s === null || v > (evs[s] as number))) s = k;
  }
  return s;
}

/** EV the player gave up by choosing `choice` instead of the book play (per 1 unit). */
export function evCost(evs: ActionEVs, choice: Action, optimal: Action, rec: Recommendation, up: number, cards: number): number | null {
  const cc = closeCallKey(rec, up, cards);
  if (cc && optimal === "double" && choice === "hit") {
    const x = EXACT_6D[cc];
    return x.double - x.hit;
  }
  const a = evs[choice];
  const b = evs[optimal];
  if (a === undefined || b === undefined) return null;
  return Math.max(0, b - a);
}

export function mistakeText(choice: Action, optimal: Action, cost: number | null): string {
  const c = cost !== null ? ` That choice costs about ${(cost * 100).toFixed(1)} chips per 100 bet over the long run.` : "";
  return `You chose ${ACTION_LABEL[choice]}, but the book play is ${ACTION_LABEL[optimal]}.${c}`;
}

// ---------------------------------------------------------------- win-chance impact

export const ACTION_GERUND: Record<Action, string> = {
  hit: "Hitting",
  stand: "Standing",
  double: "Doubling",
  split: "Splitting",
};

export interface WinImpact {
  /** [win, push, lose] for the move you chose and for the book move. */
  choice: Outcome3;
  optimal: Outcome3;
  /** Book win chance minus your win chance, in percentage points. */
  deltaPts: number;
  /** Why the book play is still right when it doesn't raise your win chance. */
  note: string | null;
}

export function winImpact(choice: Action, optimal: Action, o: ActionOutcomes): WinImpact | null {
  const c = o[choice];
  const b = o[optimal];
  if (!c || !b) return null;
  const deltaPts = (b[0] - c[0]) * 100;
  let note: string | null = null;
  const money = choice === "double" || choice === "split" || optimal === "double" || optimal === "split";
  if (deltaPts <= 0.05) {
    if (optimal === "double") {
      note = `${ACTION_GERUND[choice]} wins about as often or slightly more, but a double pays 2 bets every time it wins. With the odds in your favor, that extra money is worth more than the small change in win chance.`;
    } else if (optimal === "split") {
      note = `Each split hand wins a little less often, but splitting gets 2 bets out while the dealer is vulnerable and avoids playing a weak total, so it earns more chips over time.`;
    } else if (choice === "double" || choice === "split") {
      note = `${ACTION_GERUND[choice]} also puts a second bet at risk, so the losses cost twice as much.`;
    } else if (deltaPts < -0.05) {
      note = `${ACTION_GERUND[choice]} actually wins more often, but it also loses more: ${pct(c[2])} of the time vs ${pct(b[2])} for ${ACTION_GERUND[optimal].toLowerCase()}. ${ACTION_GERUND[optimal]} turns enough losses into pushes to come out ahead.`;
    } else {
      note = `${ACTION_GERUND[optimal]} wins about as often, but it loses less: ${pct(b[2])} of the time vs ${pct(c[2])}, because more of those hands end in a push.`;
    }
  } else if (money && (choice === "double" || choice === "split")) {
    note = `${ACTION_GERUND[choice]} also put a second bet on the table, so each loss cost twice as much.`;
  }
  return { choice: c, optimal: b, deltaPts, note };
}

/** Sentences for a mistake, e.g. "Standing wins this hand 23.0% of the time. Hitting wins 28.4%, 5.4 points more." */
export function winImpactText(choice: Action, optimal: Action, w: WinImpact): string {
  const per = (a: Action) => (a === "split" ? "each split hand wins" : "wins this hand");
  const lead = `${ACTION_GERUND[choice]} ${per(choice)} ${pct(w.choice[0])} of the time. ${ACTION_GERUND[optimal]} ${optimal === "split" ? "gives each hand" : "wins"} ${pct(w.optimal[0])}`;
  if (w.deltaPts > 0.05) return `${lead}, ${w.deltaPts.toFixed(1)} points more.`;
  return `${lead}.`;
}
