// Cross-check: the EV engine's best action vs the basic-strategy chart.
import { HARD, SOFT, PAIR_SPLIT, UPCARDS, col, resolve } from "../src/engine/strategy";
import { actionEVs, dealerBust, dealerDistribution, splitEV, standEV, hitEV, doubleEV } from "../src/engine/odds";

const lbl = (u: number) => (u === 11 ? "A" : String(u));
const best = (e: Record<string, number | undefined>) =>
  Object.entries(e).filter(([, v]) => v !== undefined).sort((a, b) => (b[1] as number) - (a[1] as number))[0][0];

let mism: string[] = [];
console.log("Dealer bust % by upcard (given no dealer BJ):");
console.log(UPCARDS.map((u) => `${lbl(u)}:${(dealerBust(u) * 100).toFixed(2)}`).join("  "));
for (let t = 5; t <= 20; t++)
  for (const u of UPCARDS) {
    const e = actionEVs({ total: t, soft: false }, u, { canDouble: true });
    const chart = resolve(HARD[t][col(u)], true);
    const b = best(e as any);
    if (b !== chart) mism.push(`hard ${t} vs ${lbl(u)}: chart=${chart} ev-best=${b} ${JSON.stringify(e, (k, v) => typeof v === "number" ? +v.toFixed(4) : v)}`);
  }
for (let t = 13; t <= 20; t++)
  for (const u of UPCARDS) {
    const e = actionEVs({ total: t, soft: true }, u, { canDouble: true });
    const chart = resolve(SOFT[t][col(u)], true);
    const b = best(e as any);
    if (b !== chart) mism.push(`soft ${t} vs ${lbl(u)}: chart=${chart} ev-best=${b} ${JSON.stringify(e, (k, v) => typeof v === "number" ? +v.toFixed(4) : v)}`);
  }
for (let v = 1; v <= 10; v++)
  for (const u of UPCARDS) {
    const s = v === 1 ? { total: 12, soft: true } : { total: 2 * v, soft: false };
    const e = actionEVs(s, u, { canDouble: true, splitValue: v });
    const chartSplit = PAIR_SPLIT[v][col(u)];
    const b = best(e as any);
    if ((b === "split") !== chartSplit) mism.push(`pair ${lbl(v === 1 ? 11 : v)}s vs ${lbl(u)}: chartSplit=${chartSplit} ev-best=${b} ${JSON.stringify(e, (k, v) => typeof v === "number" ? +v.toFixed(4) : v)}`);
  }
console.log(`\nMismatches: ${mism.length}`);
mism.forEach((m) => console.log("  " + m));
console.log("\nSpot checks:");
console.log("16 v 10 stand", standEV(16, 10).toFixed(4), "hit", hitEV({ total: 16, soft: false }, 10).toFixed(4));
console.log("11 v 6 double", doubleEV({ total: 11, soft: false }, 6).toFixed(4));
console.log("8,8 v 10 split", splitEV(8, 10).toFixed(4));
console.log("A,A v 6 split", splitEV(1, 6).toFixed(4));
console.log("dealer 6 dist", dealerDistribution(6).map((x) => x.toFixed(4)).join(" "));
