import React from "react";
import { Action } from "../engine/strategy";
import { ACTION_LABEL, winImpactText } from "../engine/explain";
import { WinChange } from "./Coach";
import { upLabel } from "../engine/cards";
import { Session } from "../game";
import { summarize, spotLabel } from "../store";
import { MiniCards } from "./CardView";

const ACTIONS: Action[] = ["hit", "stand", "double", "split"];

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto bg-black/70 backdrop-blur-sm gutter"
      style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))", paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fade-up mx-auto my-4 w-full ${wide ? "max-w-6xl" : "max-w-3xl"} rounded-2xl border border-line bg-bg p-5 shadow-2xl sm:p-7`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-display text-2xl text-brasssoft sm:text-3xl">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:border-brass hover:text-ivory"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "brass" }) {
  const c = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "brass" ? "text-brass" : "text-ivory";
  return (
    <div className="min-w-0 rounded-xl border border-line bg-panel px-4 py-3">
      <div className="label">{label}</div>
      <div className={`mt-0.5 font-mono text-2xl tnum ${c}`}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString()}`;

export function SessionSummary({
  session,
  onContinue,
  onRestart,
}: {
  session: Session;
  onContinue: () => void;
  onRestart: () => void;
}) {
  const s = summarize(session);
  const acc = s.decisions ? s.correct / s.decisions : null;
  const mistakes = session.decisions.filter((d) => !d.correct);
  const totalMistakes = mistakes.length;
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Correct decisions" value={acc === null ? "—" : `${(acc * 100).toFixed(1)}%`} tone="good" sub={`${s.correct} of ${s.decisions}`} />
        <Tile label="Mistakes" value={acc === null ? "—" : `${((1 - acc) * 100).toFixed(1)}%`} tone="bad" sub={`${totalMistakes} wrong`} />
        <Tile label="Hands played" value={String(s.rounds)} sub={`${s.decisions} decisions`} />
        <Tile label="Net chips" value={signed(s.net)} tone={s.net >= 0 ? "good" : "bad"} sub={`${s.wins}W · ${s.losses}L · ${s.pushes}P`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-4">
          <div className="label mb-3">Mistakes by the correct play</div>
          <BreakdownBars data={s.missedByOptimal} total={totalMistakes} verb="Should" />
        </div>
        <div className="rounded-xl border border-line bg-panel p-4">
          <div className="label mb-3">Mistakes by what you chose</div>
          <BreakdownBars data={s.wrongChoice} total={totalMistakes} verb="Chose" />
        </div>
      </div>

      <div>
        <div className="label mb-2">Review of incorrect decisions</div>
        {totalMistakes === 0 ? (
          <p className="rounded-xl border border-good/40 bg-good/10 p-4 text-sm">
            {s.decisions === 0 ? "No decisions recorded yet. Play a few hands first." : "A perfect session. Every decision matched basic strategy."}
          </p>
        ) : (
          <div className="grid gap-2">
            {mistakes.map((d) => (
              <details key={d.id} className="group rounded-xl border border-line bg-panel">
                <summary className="grid cursor-pointer list-none grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[auto_1fr_auto_auto]">
                  <MiniCards ranks={d.cards} />
                  <span className="text-sm">
                    <span className="text-muted">v</span> <span className="font-semibold">{upLabel(d.up)}</span>
                    <span className="ml-2 text-xs text-muted">{spotLabel(d)}</span>
                  </span>
                  <span className="text-sm">
                    <span className="text-bad">You: {ACTION_LABEL[d.choice]}</span>
                    <span className="mx-1.5 text-muted">→</span>
                    <span className="text-good">Book: {ACTION_LABEL[d.optimal]}</span>
                  </span>
                  <span className="col-span-full justify-self-start sm:col-span-1 sm:justify-self-end">
                    {d.win ? (
                      <WinChange d={d} />
                    ) : (
                      <span className="font-mono text-xs text-muted tnum">
                        {d.costPer100 !== null ? `−${d.costPer100.toFixed(1)} / 100` : ""}
                      </span>
                    )}
                  </span>
                </summary>
                <ul className="grid gap-1 border-t border-line px-4 py-3 text-sm leading-relaxed text-ivory/85">
                  {d.win && <li className="text-ivory">{winImpactText(d.choice, d.optimal, d.win)}</li>}
                  {d.win?.note && <li className="text-warn">{d.win.note}</li>}
                  {d.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={onRestart} className="rounded-xl bg-brass px-5 py-3 font-bold text-ink hover:bg-brasssoft">
          Start a new session
        </button>
        <button onClick={onContinue} className="rounded-xl border border-line px-5 py-3 font-semibold hover:border-brass">
          Keep practicing this session
        </button>
      </div>
      <p className="text-xs text-muted">This session is saved to Progress. If you keep practicing, its entry updates when you finish again.</p>
    </div>
  );
}

function BreakdownBars({ data, total, verb }: { data: Record<Action, number>; total: number; verb: string }) {
  return (
    <div className="grid gap-2">
      {ACTIONS.map((a) => (
        <div key={a} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-2 text-sm">
          <span className="text-muted">
            {verb} {ACTION_LABEL[a].toLowerCase()}
          </span>
          <div className="h-2.5 rounded-full bg-line/60">
            <div className="h-full rounded-full bg-bad" style={{ width: total ? `${(data[a] / total) * 100}%` : 0 }} />
          </div>
          <span className="text-right font-mono tnum">{data[a]}</span>
        </div>
      ))}
    </div>
  );
}
