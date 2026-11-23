// Plays many rounds through the real game reducer functions.
import { act, deal, dealerStep, decisionInfo, initialGame, GameState } from "../src/game";
import { Action } from "../src/engine/strategy";

function playRound(g: GameState, chooser: (g: GameState) => Action): { g: GameState; decisions: number; wrong: number; bet: number } {
  g = deal(g);
  let decisions = 0, wrong = 0;
  let guard = 0;
  while (g.phase === "player") {
    const info = decisionInfo(g)!;
    const a = chooser(g);
    const r = act(g, a);
    if (!r.decision) throw new Error("rejected action " + a);
    decisions++;
    if (!r.decision.correct) wrong++;
    g = r.game;
    if (++guard > 50) throw new Error("loop");
  }
  while (g.phase === "dealer") g = dealerStep(g);
  if (g.phase !== "over") throw new Error("not over: " + g.phase);
  const bet = g.hands.length ? 10 : 0;
  return { g, decisions, wrong, bet };
}

const book = (g: GameState) => decisionInfo(g)!.rec.action;
const random = (g: GameState): Action => {
  const i = decisionInfo(g)!;
  const opts: Action[] = ["hit", "stand"];
  if (i.canDouble) opts.push("double");
  if (i.canSplit) opts.push("split", "split");
  return opts[Math.floor(Math.random() * opts.length)];
};

for (const [name, fn, n] of [["book", book, 400000], ["random", random, 50000]] as const) {
  let g = initialGame(10, 0);
  let net = 0, dec = 0, wrong = 0, splits = 0, maxHands = 0;
  for (let i = 0; i < n; i++) {
    const before = g.bankroll;
    const r = playRound(g, fn as any);
    g = r.g;
    net += g.bankroll - before;
    if (g.roundNet !== g.bankroll - before) throw new Error("net mismatch");
    dec += r.decisions; wrong += r.wrong;
    if (g.hands.length > 1) splits++;
    maxHands = Math.max(maxHands, g.hands.length);
  }
  console.log(`${name}: rounds=${n} edge=${((net / (n * 10)) * 100).toFixed(3)}% decisions=${dec} wrong=${wrong} splitRounds=${splits} maxHands=${maxHands}`);
}
