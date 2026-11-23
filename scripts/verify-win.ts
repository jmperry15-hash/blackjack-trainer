import { actionEVs, actionOutcomes, addCard, P } from "../src/engine/odds";
import { winImpact, winImpactText } from "../src/engine/explain";
import { UPCARDS } from "../src/engine/strategy";
let maxErr = 0;
for (const soft of [false, true]) for (let t = soft ? 13 : 5; t <= 21; t++) for (const u of UPCARDS) {
  const s = { total: t, soft };
  const e = actionEVs(s, u, { canDouble: true });
  const o = actionOutcomes(s, u, { canDouble: true });
  for (const [k, mult] of [["stand", 1], ["hit", 1], ["double", 2]] as const) {
    const ev = (e as any)[k], w = (o as any)[k];
    if (t >= 21 && k !== "stand") continue;
    maxErr = Math.max(maxErr, Math.abs(ev - mult * (w[0] - w[2])), Math.abs(w[0] + w[1] + w[2] - 1));
  }
}
console.log("max |EV - (win-lose)| or |sum-1| =", maxErr.toExponential(2));

// Monte Carlo (infinite deck): 16 v 10 hit-then-book, 11 v 6 double
const draw = () => { let r = Math.random() * 13; return r < 1 ? 1 : r >= 9 ? 10 : Math.floor(r) + 1; };
function dealer(up: number) { let s = up === 11 ? { total: 11, soft: true } : { total: up, soft: false };
  for (;;) { // condition on no BJ via rejection of hole card
    const h = draw(); if ((up === 11 && h === 10) || (up === 10 && h === 1)) continue; s = addCard(s, h); break; }
  while (s.total < 17) s = addCard(s, draw()); return s.total; }
function mc(n: number, play: () => number, up: number) { let w = 0, p = 0;
  for (let i = 0; i < n; i++) { const pt = play(); if (pt > 21) continue; const d = dealer(up); if (d > 21 || pt > d) w++; else if (pt === d) p++; }
  return [w / n, p / n]; }
const N = 2_000_000;
const exact16 = actionOutcomes({ total: 16, soft: false }, 10, { canDouble: false }).hit!;
console.log("16 v 10 hit once then stand-ish: exact win", exact16[0].toFixed(4));
console.log("  MC (hit once; 17+ stand, else keep hitting below 17):", mc(N, () => { let s = { total: 16, soft: false }; do { s = addCard(s, draw()); } while (s.total < 17); return s.total; }, 10).map(x => x.toFixed(4)).join(" push "));
const ex11 = actionOutcomes({ total: 11, soft: false }, 6, { canDouble: true });
console.log("11 v 6 double exact win", ex11.double![0].toFixed(4), " MC", mc(N, () => addCard({ total: 11, soft: false }, draw()).total, 6)[0].toFixed(4));
console.log("11 v 6 hit exact win", ex11.hit![0].toFixed(4));
console.log("\nExamples:");
const show = (label: string, s: any, u: number, choice: any, opt: any, split?: number) => {
  const o = actionOutcomes(s, u, { canDouble: true, splitValue: split });
  const w = winImpact(choice, opt, o)!;
  console.log(`${label}: ${winImpactText(choice, opt, w)}${w.note ? "  NOTE: " + w.note : ""}`);
};
show("16 v 10 stand", { total: 16, soft: false }, 10, "stand", "hit");
show("12 v 4 hit", { total: 12, soft: false }, 4, "hit", "stand");
show("11 v 6 hit", { total: 11, soft: false }, 6, "hit", "double");
show("8,8 v 10 hit", { total: 16, soft: false }, 10, "hit", "split", 8);
show("3,3 v 9 double", { total: 6, soft: false }, 9, "double", "hit", 3);
show("2,2 v 3 hit", { total: 4, soft: false }, 3, "hit", "split", 2);
