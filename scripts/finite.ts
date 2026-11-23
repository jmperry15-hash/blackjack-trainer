// Exact composition-dependent 6-deck EVs for a specific starting hand (no depletion approximations).
type S = { t: number; s: boolean };
const add = (st: S, v: number): S => {
  if (v === 1) return st.t + 11 <= 21 ? { t: st.t + 11, s: true } : { t: st.t + 1, s: st.s };
  const t = st.t + v;
  return t > 21 && st.s ? { t: t - 10, s: false } : { t, s: st.s };
};
const key = (c: number[]) => c.join(",");
function dealer(c: number[], st: S, memo: Map<string, number[]>): number[] {
  if (st.t > 21) return [0, 0, 0, 0, 0, 1];
  if (st.t >= 17) { const d = [0, 0, 0, 0, 0, 0]; d[st.t - 17] = 1; return d; }
  const k = key(c) + "|" + st.t + st.s;
  const m = memo.get(k); if (m) return m;
  const n = c.reduce((a, b) => a + b, 0) - c[0];
  const out = [0, 0, 0, 0, 0, 0];
  for (let v = 1; v <= 10; v++) if (c[v]) { const p = c[v] / n; c[v]--; const d = dealer(c, add(st, v), memo); c[v]++; for (let i = 0; i < 6; i++) out[i] += p * d[i]; }
  memo.set(k, out); return out;
}
function run(p1: number, p2: number, up: number) {
  const c = [0, 24, 24, 24, 24, 24, 24, 24, 24, 24, 96];
  c[p1]--; c[p2]--; c[up]--;
  const dm = new Map<string, number[]>();
  const upS: S = up === 1 ? { t: 11, s: true } : { t: up, s: false };
  const stand = (t: number) => { const d = dealer(c, upS, dm); let ev = d[5]; for (let i = 0; i < 5; i++) ev += t > 17 + i ? d[i] : t < 17 + i ? -d[i] : 0; return t > 21 ? -1 : ev; };
  const N = () => c.reduce((a, b) => a + b, 0) - c[0];
  const hit = (st: S): number => { let ev = 0; const n = N(); for (let v = 1; v <= 10; v++) if (c[v]) { const p = c[v] / n; c[v]--; const ns = add(st, v); ev += ns.t > 21 ? -p : p * Math.max(stand(ns.t), ns.t >= 21 ? -9 : hit(ns)); c[v]++; } return ev; };
  const dbl = (st: S): number => { let ev = 0; const n = N(); for (let v = 1; v <= 10; v++) if (c[v]) { const p = c[v] / n; c[v]--; ev += p * 2 * stand(add(st, v).t); c[v]++; } return ev; };
  const st = add(add({ t: 0, s: false }, p1), p2);
  return { hit: +hit(st).toFixed(5), double: +dbl(st).toFixed(5), stand: +stand(st.t).toFixed(5) };
}
console.log("6-deck exact  A,2 v 5:", run(1, 2, 5));
console.log("6-deck exact  A,4 v 4:", run(1, 4, 4));
console.log("6-deck exact  A,3 v 4 (chart: hit):", run(1, 3, 4));
