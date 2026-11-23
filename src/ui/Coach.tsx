import React from "react";
import { Action } from "../engine/strategy";
import { ActionEVs, bustOnNextCard, dealerDistribution } from "../engine/odds";
import { ACTION_LABEL, Explanation, mistakeText, pct, per100, winImpactText } from "../engine/explain";
import { upLabel } from "../engine/cards";
import { Decision, DecisionInfo } from "../game";

const ORDER: Action[] = ["hit", "stand", "double", "split"];

export function DealerOdds({ up }: { up: number }) {
  const d = dealerDistribution(up);
  const parts = [
    { k: "17", p: d[0] },
    { k: "18", p: d[1] },
    { k: "19", p: d[2] },
    { k: "20", p: d[3] },
    { k: "21", p: d[4] },
    { k: "Bust", p: d[5] },
  ];
  return (
    <div className="min-w-0">
      <div className="label mb-1.5">Dealer {upLabel(up)} finishes on</div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
        {parts.map((x, i) => (
          <div
            key={x.k}
            style={{ width: `${x.p * 100}%`, opacity: x.k === "Bust" ? 1 : 0.35 + i * 0.12 }}
            className={x.k === "Bust" ? "bg-good" : "bg-brasssoft"}
          />
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-6 gap-1 text-center">
        {parts.map((x) => (
          <div key={x.k} className="min-w-0">
            <div className={`text-[0.65rem] ${x.k === "Bust" ? "text-good" : "text-muted"}`}>{x.k}</div>
            <div className="font-mono text-[0.7rem] tnum">{(x.p * 100).toFixed(1)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EVBars({ evs, best }: { evs: ActionEVs; best: Action }) {
  const entries = ORDER.filter((a) => evs[a] !== undefined).map((a) => ({ a, v: evs[a] as number }));
  const max = Math.max(1, ...entries.map((e) => Math.abs(e.v)));
  return (
    <div className="min-w-0">
      <div className="label mb-1.5">Expected result per 100 chips bet</div>
      <div className="grid gap-1.5">
        {entries.map(({ a, v }) => (
          <div key={a} className="grid grid-cols-[4.2rem_1fr_3.6rem] items-center gap-2 text-sm">
            <span className={a === best ? "font-bold text-brass" : "text-muted"}>{ACTION_LABEL[a]}</span>
            <div className="relative h-2.5 rounded-full bg-line/60">
              <div className="absolute inset-y-0 left-1/2 w-px bg-muted/60" />
              <div
                className={`absolute inset-y-0 rounded-full ${v >= 0 ? "bg-good" : "bg-bad"} ${a === best ? "" : "opacity-60"}`}
                style={
                  v >= 0
                    ? { left: "50%", width: `${(v / max) * 50}%` }
                    : { right: "50%", width: `${(-v / max) * 50}%` }
                }
              />
            </div>
            <span className={`text-right font-mono text-[0.8rem] tnum ${a === best ? "text-brass" : ""}`}>{per100(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Coach({
  info,
  explanation,
  up,
  hintsFirst,
  last,
  phase,
  onToggleHints,
}: {
  info: DecisionInfo | null;
  explanation: Explanation | null;
  up: number;
  hintsFirst: boolean;
  last: Decision | null;
  phase: string;
  onToggleHints: () => void;
}) {
  const showAdvice = info && explanation && hintsFirst;
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl text-brasssoft">Coach</h2>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted" htmlFor="hints-toggle">
          <input
            id="hints-toggle"
            type="checkbox"
            className="h-4 w-4 accent-[rgb(var(--brass))]"
            checked={hintsFirst}
            onChange={onToggleHints}
          />
          Show book play before I act
        </label>
      </div>

      {last && <Feedback d={last} />}

      {info && (
        <section className="fade-up grid gap-4 rounded-xl border border-line bg-panel p-4">
          {showAdvice ? (
            <div>
              <div className="label">Book play</div>
              <div className="mt-0.5 font-display text-3xl text-brass">{ACTION_LABEL[info.rec.action]}</div>
              <p className="mt-1 text-sm text-ivory/90">{explanation!.headline}.</p>
              <ul className="mt-2 grid gap-1.5 text-sm leading-relaxed text-ivory/85">
                {explanation!.reasons.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-[0.55em] h-1 w-1 flex-none rounded-full bg-brass" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted">Make your call. The coach will grade it and explain the book play.</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label="Dealer busts"
              value={pct(dealerDistribution(up)[5])}
              tone="good"
              sub={`with ${upLabel(up)} showing`}
            />
            <Stat
              label="You bust if you hit"
              value={pct(bustOnNextCard({ total: info.rec.total, soft: info.rec.soft }))}
              tone="bad"
              sub="on the next card"
            />
          </div>
          <DealerOdds up={up} />
          {showAdvice && <EVBars evs={info.evs} best={info.rec.action} />}
          <p className="text-[0.7rem] leading-snug text-muted">
            All figures are calculated, not looked up: full 6-deck card frequencies, dealer stands on 17, odds taken after
            the dealer's blackjack check. Split EV includes re-splits to 4 hands and doubling after splits.
          </p>
        </section>
      )}

      {!info && !last && (
        <section className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
          {phase === "idle" || phase === "over"
            ? "Deal a hand. For every decision the coach shows the book play, why it's right, and the odds behind it."
            : "Dealer is playing out the hand."}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-line/70 bg-bg/50 px-3 py-2">
      <div className="label">{label}</div>
      <div className={`font-mono text-xl tnum ${tone === "good" ? "text-good" : "text-bad"}`}>{value}</div>
      <div className="text-[0.7rem] text-muted">{sub}</div>
    </div>
  );
}

export function Feedback({ d }: { d: Decision }) {
  return (
    <section
      key={d.id}
      className={`pop rounded-xl border p-4 ${d.correct ? "border-good/50 bg-good/10" : "border-bad/60 bg-bad/10"}`}
      aria-live="polite"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className={`font-display text-lg ${d.correct ? "text-good" : "text-bad"}`}>
          {d.correct ? `Correct: ${ACTION_LABEL[d.choice]}` : `Mistake: you chose ${ACTION_LABEL[d.choice]}`}
        </div>
        <div className="font-mono text-xs text-muted">
          {d.cards.join(" ")} v {upLabel(d.up)}
        </div>
      </div>
      {!d.correct && (
        <>
          {d.win ? (
            <>
              <p className="mt-1 text-sm">
                You chose {ACTION_LABEL[d.choice]}, but the book play is {ACTION_LABEL[d.optimal]}.
              </p>
              <WinChange d={d} className="mt-2" />
              <p className="mt-2 text-sm">{winImpactText(d.choice, d.optimal, d.win)}</p>
              {d.win.note && <p className="mt-1 text-sm text-warn">{d.win.note}</p>}
            </>
          ) : (
            <p className="mt-1 text-sm">{mistakeText(d.choice, d.optimal, d.costPer100 === null ? null : d.costPer100 / 100)}</p>
          )}
          <ul className="mt-2 grid gap-1 text-sm leading-relaxed text-ivory/85">
            {d.reasons.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-[0.55em] h-1 w-1 flex-none rounded-full bg-bad" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Play continues with your choice.</p>
        </>
      )}
    </section>
  );
}

/** Compact "win 23.0% → 28.4%  +5.4 pts" readout for a mistake. */
export function WinChange({ d, className = "" }: { d: Decision; className?: string }) {
  if (!d.win) return null;
  const w = d.win;
  const gain = w.deltaPts > 0.05;
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 font-mono text-xs tnum ${className}`}>
      <span className="text-muted">Win chance</span>
      <span className="text-bad">{pct(w.choice[0])}</span>
      <span className="text-muted">→</span>
      <span className="text-good">{pct(w.optimal[0])}</span>
      {gain ? (
        <span className="rounded bg-good/15 px-1.5 text-good">+{w.deltaPts.toFixed(1)} pts</span>
      ) : (
        <span className="rounded bg-warn/15 px-1.5 text-warn">{w.deltaPts < -0.05 ? `${w.deltaPts.toFixed(1)} pts, still right` : "about even"}</span>
      )}
    </span>
  );
}
