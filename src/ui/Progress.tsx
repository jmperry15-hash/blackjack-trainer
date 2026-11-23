import React from "react";
import { ACTION_LABEL } from "../engine/explain";
import { HandKind } from "../engine/strategy";
import { SessionSummary, spotLabel } from "../store";
import { Tile, signed } from "./Summary";

export function Progress({
  history,
  current,
  onClear,
}: {
  history: SessionSummary[];
  current: SessionSummary | null;
  onClear: () => void;
}) {
  const [confirm, setConfirm] = React.useState(false);
  const all = current && current.decisions > 0 && !history.some((h) => h.id === current.id) ? [...history, current] : history.map((h) => (current && h.id === current.id ? current : h));
  const withDecisions = all.filter((s) => s.decisions > 0);
  const totalDec = all.reduce((a, s) => a + s.decisions, 0);
  const totalCorrect = all.reduce((a, s) => a + s.correct, 0);
  const tests = withDecisions.filter((s) => s.mode === "test");
  const acc = (xs: SessionSummary[]) => {
    const d = xs.reduce((a, s) => a + s.decisions, 0);
    return d ? xs.reduce((a, s) => a + s.correct, 0) / d : null;
  };
  const firstTests = acc(tests.slice(0, 3));
  const lastTests = acc(tests.slice(-3));
  const net = all.reduce((a, s) => a + s.net, 0);
  const rounds = all.reduce((a, s) => a + s.rounds, 0);

  const byKind: Record<HandKind, [number, number]> = { hard: [0, 0], soft: [0, 0], pair: [0, 0] };
  for (const s of all) for (const k of ["hard", "soft", "pair"] as HandKind[]) {
    byKind[k][0] += s.byKind[k][0];
    byKind[k][1] += s.byKind[k][1];
  }

  const spots = new Map<string, { n: number; optimal: string; cost: number }>();
  for (const s of all)
    for (const m of s.mistakes) {
      const k = spotLabel(m);
      const e = spots.get(k) ?? { n: 0, optimal: ACTION_LABEL[m.optimal], cost: 0 };
      e.n++;
      e.cost += m.costPer100 ?? 0;
      spots.set(k, e);
    }
  const leaks = [...spots.entries()].sort((a, b) => b[1].n - a[1].n || b[1].cost - a[1].cost).slice(0, 8);

  if (totalDec === 0)
    return (
      <div className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">
        No decisions yet. Play some hands in Learn or Test mode, then press Finish Session. Each session's accuracy appears
        here so you can watch it climb.
      </div>
    );

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Lifetime accuracy" value={`${((totalCorrect / totalDec) * 100).toFixed(1)}%`} tone="good" sub={`${totalDec} decisions`} />
        <Tile
          label="Test mode trend"
          value={lastTests === null ? "—" : `${(lastTests * 100).toFixed(1)}%`}
          tone="brass"
          sub={
            firstTests === null || tests.length < 2
              ? "Finish 2+ test sessions"
              : `last 3 vs first 3: ${signed(Math.round((lastTests! - firstTests) * 1000) / 10)} pts`
          }
        />
        <Tile label="Sessions" value={String(withDecisions.length)} sub={`${rounds} hands played`} />
        <Tile label="Lifetime net chips" value={signed(net)} tone={net >= 0 ? "good" : "bad"} sub="luck matters short-term" />
      </div>

      <div className="rounded-xl border border-line bg-panel p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="label">Accuracy by session</div>
          <div className="flex gap-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-brass" />
              Test
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-info" />
              Learn
            </span>
          </div>
        </div>
        <AccuracyChart sessions={withDecisions} currentId={current?.id} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-4">
          <div className="label mb-3">Accuracy by hand type</div>
          <div className="grid gap-2.5">
            {(["hard", "soft", "pair"] as HandKind[]).map((k) => {
              const [c, t] = byKind[k];
              const a = t ? c / t : 0;
              return (
                <div key={k} className="grid grid-cols-[5.5rem_1fr_6.5rem] items-center gap-3 text-sm">
                  <span className="capitalize text-muted">{k === "pair" ? "Pairs" : `${k} totals`}</span>
                  <div className="h-2.5 rounded-full bg-line/60">
                    <div className="h-full rounded-full bg-good" style={{ width: `${a * 100}%` }} />
                  </div>
                  <span className="text-right font-mono text-xs tnum">
                    {t ? `${(a * 100).toFixed(0)}%` : "—"} <span className="text-muted">({t})</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4">
          <div className="label mb-3">Your most-missed spots</div>
          {leaks.length === 0 ? (
            <p className="text-sm text-muted">No mistakes recorded. Nicely done.</p>
          ) : (
            <table className="w-full text-sm tnum">
              <tbody>
                {leaks.map(([k, e]) => (
                  <tr key={k} className="border-b border-line/50 last:border-0">
                    <td className="py-1.5 font-mono text-xs">{k}</td>
                    <td className="py-1.5 text-good">Book: {e.optimal}</td>
                    <td className="py-1.5 text-right font-mono text-xs text-muted">×{e.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {confirm ? (
          <>
            <span className="text-sm">Delete all saved sessions on this device?</span>
            <button
              onClick={() => {
                onClear();
                setConfirm(false);
              }}
              className="rounded-lg bg-bad px-4 py-2 text-sm font-bold text-ink"
            >
              Delete history
            </button>
            <button onClick={() => setConfirm(false)} className="rounded-lg border border-line px-4 py-2 text-sm">
              Cancel
            </button>
          </>
        ) : (
          <button onClick={() => setConfirm(true)} className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ivory">
            Clear history
          </button>
        )}
        <span className="text-xs text-muted">Saved in this browser only.</span>
      </div>
    </div>
  );
}

function AccuracyChart({ sessions, currentId }: { sessions: SessionSummary[]; currentId?: string }) {
  const W = 640;
  const H = 220;
  const pad = { l: 40, r: 16, t: 12, b: 28 };
  const pts = sessions.slice(-30);
  const accs = pts.map((s) => s.correct / s.decisions);
  const lo = Math.min(0.5, Math.floor(Math.min(...accs) * 10) / 10);
  const y = (a: number) => pad.t + (1 - (a - lo) / (1 - lo)) * (H - pad.t - pad.b);
  const x = (i: number) => (pts.length === 1 ? (W + pad.l - pad.r) / 2 : pad.l + (i / (pts.length - 1)) * (W - pad.l - pad.r));
  const ticks: number[] = [];
  for (let t = lo; t <= 1.0001; t += lo <= 0.5 ? 0.1 : 0.1) ticks.push(Math.round(t * 100) / 100);
  const path = pts.map((_, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(accs[i]).toFixed(1)}`).join(" ");
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]" role="img" aria-label="Decision accuracy for each session">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgb(var(--line))" strokeWidth="1" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="rgb(var(--muted))" fontFamily="IBM Plex Mono, monospace">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        <path d={`${path} L${x(pts.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`} fill="rgb(var(--brass) / 0.08)" />
        <path d={path} fill="none" stroke="rgb(var(--brass))" strokeWidth="2" strokeLinejoin="round" />
        {pts.map((s, i) => (
          <g key={s.id}>
            <circle
              cx={x(i)}
              cy={y(accs[i])}
              r={s.id === currentId ? 6 : 4.5}
              fill={s.mode === "test" ? "rgb(var(--brass))" : "rgb(var(--bg))"}
              stroke={s.mode === "test" ? "rgb(var(--brass))" : "rgb(var(--info))"}
              strokeWidth="2"
            >
              <title>{`${s.mode === "test" ? "Test" : "Learn"} · ${new Date(s.startedAt).toLocaleDateString()} · ${(accs[i] * 100).toFixed(1)}% of ${s.decisions}`}</title>
            </circle>
            {(pts.length <= 12 || i === pts.length - 1 || i === 0) && (
              <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="rgb(var(--muted))" fontFamily="IBM Plex Mono, monospace">
                {s.id === currentId ? "now" : `#${sessions.length - pts.length + i + 1}`}
              </text>
            )}
          </g>
        ))}
        {pts.length > 0 && (
          <text
            x={Math.min(x(pts.length - 1), W - pad.r - 4)}
            y={y(accs[accs.length - 1]) - 10}
            textAnchor="end"
            fontSize="12"
            fontWeight="700"
            fill="rgb(var(--brass-soft))"
            fontFamily="IBM Plex Mono, monospace"
          >
            {(accs[accs.length - 1] * 100).toFixed(1)}%
          </text>
        )}
      </svg>
    </div>
  );
}
