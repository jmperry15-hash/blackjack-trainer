import React from "react";
import { Action } from "../engine/strategy";
import { handValue, upLabel } from "../engine/cards";
import { ACTION_LABEL } from "../engine/explain";
import {
  GameState,
  Mode,
  Session,
  SHOE_SIZE,
  START_BANKROLL,
  act,
  applyRoundToSession,
  deal,
  dealerStep,
  dealerUp,
  decisionInfo,
  explainCurrent,
  initialGame,
  newSession,
  PlayerHand,
} from "../game";
import { DEFAULTS, Persisted, SessionSummary, Settings, load, save, summarize, upsertHistory } from "../store";
import { CardView } from "./CardView";
import { Coach } from "./Coach";
import { StrategyChart } from "./StrategyChart";
import { Modal, SessionSummary as SummaryView, signed } from "./Summary";
import { Progress } from "./Progress";

// ---------------------------------------------------------------- state

interface AppState {
  game: GameState;
  session: Session;
  history: SessionSummary[];
  settings: Settings;
  modal: null | "chart" | "progress" | "summary";
  toast: string | null;
}

type Msg =
  | { t: "deal" }
  | { t: "act"; a: Action }
  | { t: "dealerStep" }
  | { t: "bet"; v: number }
  | { t: "mode"; m: Mode }
  | { t: "finish" }
  | { t: "newSession" }
  | { t: "modal"; m: AppState["modal"] }
  | { t: "hints" }
  | { t: "speed" }
  | { t: "clearHistory" }
  | { t: "rebuy" }
  | { t: "toast"; s: string | null };

function withRound(prev: AppState, game: GameState): AppState {
  let session = prev.session;
  if (prev.game.phase !== "over" && game.phase === "over") session = applyRoundToSession(session, game);
  return { ...prev, game, session };
}

function reducer(s: AppState, m: Msg): AppState {
  switch (m.t) {
    case "deal": {
      if (s.game.phase === "player" || s.game.phase === "dealer") return s;
      const next = withRound(s, deal(s.game));
      return next.game.shuffledNotice ? { ...next, toast: "Cut card reached. Fresh 6-deck shoe shuffled." } : next;
    }
    case "act": {
      const r = act(s.game, m.a);
      if (!r.decision) return s;
      const st = withRound(s, r.game);
      return { ...st, session: { ...st.session, decisions: [...st.session.decisions, r.decision] } };
    }
    case "dealerStep":
      return withRound(s, dealerStep(s.game));
    case "bet":
      if (s.game.phase === "player" || s.game.phase === "dealer") return s;
      return { ...s, game: { ...s.game, bet: m.v } };
    case "mode": {
      if (m.m === s.session.mode) return s;
      if (s.session.decisions.length > 0 || s.session.rounds > 0) {
        return {
          ...s,
          history: upsertHistory(s.history, summarize(s.session)),
          session: newSession(m.m),
          game: { ...initialGame(s.game.bet, s.game.bankroll), shoe: s.game.shoe },
          toast: `${s.session.mode === "learn" ? "Learn" : "Test"} session saved to Progress. New ${m.m} session started.`,
        };
      }
      return { ...s, session: { ...s.session, mode: m.m }, game: { ...s.game, lastDecision: null } };
    }
    case "finish":
      return { ...s, history: upsertHistory(s.history, summarize(s.session)), modal: "summary" };
    case "newSession":
      return {
        ...s,
        session: newSession(s.session.mode),
        game: { ...initialGame(s.game.bet, s.game.bankroll), shoe: s.game.shoe },
        modal: null,
      };
    case "modal":
      return { ...s, modal: m.m };
    case "hints":
      return { ...s, settings: { ...s.settings, hintsFirst: !s.settings.hintsFirst } };
    case "speed":
      return { ...s, settings: { ...s.settings, speed: s.settings.speed === "fast" ? "normal" : "fast" } };
    case "clearHistory":
      return { ...s, history: [] };
    case "rebuy":
      return { ...s, game: { ...s.game, bankroll: s.game.bankroll + START_BANKROLL }, toast: "Added 1,000 chips to your stack." };
    case "toast":
      return { ...s, toast: m.s };
  }
}

function init(hot?: Partial<AppState>): AppState {
  const p: Persisted = load();
  const base: AppState = {
    game: initialGame(p.bet, p.bankroll),
    session: p.session ?? newSession("learn"),
    history: p.history ?? [],
    settings: p.settings ?? DEFAULTS.settings,
    modal: null,
    toast: null,
  };
  if (hot && hot.game && hot.session) return { ...base, ...hot, modal: null, toast: null } as AppState;
  return base;
}

// ---------------------------------------------------------------- app

declare global {
  interface Window {
    claude?: { hot?: { snapshot?: (fn: () => unknown) => void; ready?: (fn: (d: unknown) => void) => void; data?: unknown } };
  }
}

const CHIPS = [
  { v: 5, c: "rgb(var(--oxblood))" },
  { v: 10, c: "rgb(52 96 170)" },
  { v: 25, c: "rgb(40 128 82)" },
  { v: 50, c: "rgb(196 120 40)" },
  { v: 100, c: "rgb(30 30 30)" },
];

export function App({ hot }: { hot?: Partial<AppState> }) {
  const [s, dispatch] = React.useReducer(reducer, hot, init);
  const { game, session, settings } = s;
  const mode = session.mode;
  const learn = mode === "learn";

  // persist
  React.useEffect(() => {
    save({ v: 1, bankroll: game.bankroll, bet: game.bet, settings, session, history: s.history });
  }, [game.bankroll, game.bet, settings, session, s.history]);

  // hot-reload snapshot for open viewers
  const ref = React.useRef(s);
  ref.current = s;
  React.useEffect(() => {
    window.claude?.hot?.snapshot?.(() => ({ game: ref.current.game, session: ref.current.session, history: ref.current.history, settings: ref.current.settings }));
  }, []);

  // dealer autoplay
  React.useEffect(() => {
    if (game.phase !== "dealer") return;
    const ms = settings.speed === "fast" ? 380 : 700;
    const id = setTimeout(() => dispatch({ t: "dealerStep" }), ms);
    return () => clearTimeout(id);
  }, [game.phase, game.dealer.length, game.holeHidden, settings.speed]);

  // toast timeout
  React.useEffect(() => {
    if (!s.toast) return;
    const id = setTimeout(() => dispatch({ t: "toast", s: null }), 3200);
    return () => clearTimeout(id);
  }, [s.toast]);

  const info = React.useMemo(() => decisionInfo(game), [game]);
  const explanation = React.useMemo(() => (info ? explainCurrent(game, info) : null), [game, info]);
  const up = dealerUp(game);
  const canDeal = game.phase === "idle" || game.phase === "over";

  // keyboard
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (s.modal || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const key = e.key.toLowerCase();
      if (key === "c" && learn) {
        dispatch({ t: "modal", m: "chart" });
        return;
      }
      if (info) {
        if (key === "h") dispatch({ t: "act", a: "hit" });
        else if (key === "s") dispatch({ t: "act", a: "stand" });
        else if (key === "d" && info.canDouble) dispatch({ t: "act", a: "double" });
        else if (key === "p" && info.canSplit) dispatch({ t: "act", a: "split" });
        else return;
        e.preventDefault();
      } else if (canDeal && (key === "n" || key === "enter" || key === " ")) {
        if (key !== "n" && (tag === "BUTTON" || tag === "SUMMARY")) return;
        e.preventDefault();
        dispatch({ t: "deal" });
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [info, canDeal, s.modal, learn]);

  const correct = session.decisions.filter((d) => d.correct).length;
  const liveAcc = session.decisions.length ? correct / session.decisions.length : null;
  const highlight = info ? { kind: info.rec.kind, rowKey: info.rec.rowKey, up } : null;
  const currentSummary = React.useMemo(() => summarize(session), [session]);

  return (
    <div className="min-h-full">
      {/* header */}
      <header className="gutter border-b border-line/70 bg-bg/95" style={{ paddingBlock: "14px" }}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-2xl tracking-wide text-brasssoft sm:text-[1.7rem]">By the Book</h1>
            <span className="hidden text-xs text-muted sm:inline">Blackjack basic strategy trainer · 6 decks · S17 · DAS</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <div role="tablist" aria-label="Mode" className="flex rounded-xl border border-line bg-panel p-1">
              {(["learn", "test"] as Mode[]).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => dispatch({ t: "mode", m })}
                  disabled={game.phase === "player" || game.phase === "dealer"}
                  className={`rounded-lg px-2.5 py-1.5 text-sm font-semibold transition sm:px-3.5 disabled:cursor-not-allowed ${
                    mode === m ? "bg-brass text-ink" : "text-muted hover:text-ivory disabled:opacity-50"
                  }`}
                  title={game.phase === "player" || game.phase === "dealer" ? "Finish the hand to switch modes" : undefined}
                >
                  {m === "learn" ? "Learn" : "Test"}
                </button>
              ))}
            </div>
            <button
              onClick={() => dispatch({ t: "modal", m: "chart" })}
              disabled={!learn}
              title={learn ? "Basic strategy chart (C)" : "The chart is hidden during tests"}
              className="rounded-xl border border-line px-2.5 py-2 text-sm hover:border-brass disabled:cursor-not-allowed disabled:opacity-40 sm:px-3"
            >
              Chart
            </button>
            <button onClick={() => dispatch({ t: "modal", m: "progress" })} className="rounded-xl border border-line px-2.5 py-2 text-sm hover:border-brass sm:px-3">
              Progress
            </button>
            <button
              onClick={() => dispatch({ t: "finish" })}
              className="rounded-xl border border-brass/70 bg-brass/10 px-3 py-2 text-sm font-semibold text-brasssoft hover:bg-brass/20"
            >
              <span className="sm:hidden">Finish</span>
              <span className="hidden sm:inline">Finish session</span>
            </button>
          </div>
        </div>
      </header>

      {/* stats strip */}
      <div className="gutter border-b border-line/50" style={{ paddingBlock: "10px" }}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 text-sm tnum sm:gap-x-6">
          <Pill label="Mode" value={learn ? "Learn · coached" : "Test · no hints"} tone={learn ? "info" : "brass"} />
          <Pill label="Hands" value={String(session.rounds)} />
          <Pill label="W · L · P" value={`${session.wins} · ${session.losses} · ${session.pushes}`} />
          <Pill label="Net" value={signed(session.net)} tone={session.net > 0 ? "good" : session.net < 0 ? "bad" : undefined} />
          <Pill label="Decisions" value={String(session.decisions.length)} />
          {learn && <Pill label="On the book" value={liveAcc === null ? "—" : `${(liveAcc * 100).toFixed(0)}%`} tone="good" />}
          <span className="ml-auto flex items-center gap-3">
            <Pill label="Stack" value={game.bankroll.toLocaleString()} tone={game.bankroll < 0 ? "bad" : undefined} />
            {game.bankroll < game.bet * 4 && canDeal && (
              <button onClick={() => dispatch({ t: "rebuy" })} className="rounded-lg border border-line px-2 py-1 text-xs hover:border-brass">
                Add 1,000
              </button>
            )}
          </span>
        </div>
      </div>

      <main className="gutter" style={{ paddingBlock: "20px 40px" }}>
        <div className={`mx-auto grid max-w-7xl gap-6 ${learn ? "lg:grid-cols-[minmax(0,1fr)_380px]" : "lg:grid-cols-[minmax(0,1fr)_300px]"}`}>
          <div className="min-w-0">
            <Table game={game} up={up} />
            <Controls
              game={game}
              info={info}
              learn={learn}
              hintsFirst={settings.hintsFirst}
              onAct={(a) => dispatch({ t: "act", a })}
              onDeal={() => dispatch({ t: "deal" })}
              onBet={(v) => dispatch({ t: "bet", v })}
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span className="hidden sm:inline">
                Keys: <Kbd>H</Kbd> hit <Kbd>S</Kbd> stand <Kbd>D</Kbd> double <Kbd>P</Kbd> split <Kbd>N</Kbd> new hand
                {learn && (
                  <>
                    {" "}
                    <Kbd>C</Kbd> chart
                  </>
                )}
              </span>
              <button onClick={() => dispatch({ t: "speed" })} className="rounded-md border border-line px-2 py-1 hover:border-brass">
                Dealer speed: {settings.speed === "fast" ? "Fast" : "Normal"}
              </button>
            </div>
          </div>

          <aside className="min-w-0">
            {learn ? (
              <Coach
                info={info}
                explanation={explanation}
                up={up}
                hintsFirst={settings.hintsFirst}
                last={game.lastDecision}
                phase={game.phase}
                onToggleHints={() => dispatch({ t: "hints" })}
              />
            ) : (
              <TestPanel session={session} />
            )}
          </aside>
        </div>
      </main>

      {s.toast && (
        <div
          className="fade-up fixed left-1/2 z-50 -translate-x-1/2 rounded-xl border border-brass/60 bg-panel px-4 py-2.5 text-sm shadow-xl"
          style={{ bottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}
          role="status"
        >
          {s.toast}
        </div>
      )}

      {s.modal === "chart" && (
        <Modal title="Basic strategy chart" onClose={() => dispatch({ t: "modal", m: null })} wide>
          <StrategyChart hl={highlight} />
        </Modal>
      )}
      {s.modal === "progress" && (
        <Modal title="Progress" onClose={() => dispatch({ t: "modal", m: null })} wide>
          <Progress history={s.history} current={currentSummary} onClear={() => dispatch({ t: "clearHistory" })} />
        </Modal>
      )}
      {s.modal === "summary" && (
        <Modal title={`${learn ? "Learn" : "Test"} session results`} onClose={() => dispatch({ t: "modal", m: null })}>
          <SummaryView
            session={session}
            onContinue={() => dispatch({ t: "modal", m: null })}
            onRestart={() => dispatch({ t: "newSession" })}
          />
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="mx-0.5 rounded border border-line bg-panel px-1.5 py-0.5 font-mono text-[0.7rem] text-ivory">{children}</kbd>;
}

function Pill({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "brass" | "info" }) {
  const c = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "brass" ? "text-brass" : tone === "info" ? "text-info" : "text-ivory";
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="label">{label}</span>
      <span className={`font-mono ${c}`}>{value}</span>
    </span>
  );
}

function totalText(cards: PlayerHand["cards"], natural: boolean) {
  const v = handValue(cards);
  if (natural) return "Blackjack";
  if (v.total > 21) return `Bust ${v.total}`;
  return v.soft && v.total < 21 ? `Soft ${v.total}` : String(v.total);
}

function Table({ game, up }: { game: GameState; up: number }) {
  const initial = game.hands.length === 1 && game.hands[0].cards.length === 2;
  const dealerTotal = game.dealer.length
    ? game.holeHidden
      ? `Showing ${upLabel(up)}`
      : game.dealer.length === 2 && handValue(game.dealer).total === 21
        ? "Blackjack"
        : handValue(game.dealer).total > 21
          ? `Bust ${handValue(game.dealer).total}`
          : String(handValue(game.dealer).total)
    : "";
  const left = game.shoe.length;
  return (
    <div className="felt relative overflow-hidden rounded-[28px] px-4 pb-6 pt-5 sm:px-8 sm:pb-8">
      {/* shoe */}
      <div className="absolute right-4 top-4 hidden w-28 text-right sm:block" aria-label={`${left} cards left in the shoe`}>
        <div className="label !text-brasssoft/80">Shoe</div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/30">
          <div className="h-full bg-brasssoft/70" style={{ width: `${(left / SHOE_SIZE) * 100}%` }} />
        </div>
        <div className="mt-1 font-mono text-[0.68rem] text-ivory/70 tnum">{left} / {SHOE_SIZE}</div>
      </div>

      {/* dealer */}
      <section className="relative grid justify-items-center gap-2" aria-label="Dealer">
        <div className="flex items-center gap-2">
          <span className="label !text-brasssoft/80">Dealer</span>
          {dealerTotal && <TotalBadge text={dealerTotal} />}
        </div>
        <div className="flex min-h-[calc(clamp(56px,13vw,84px)*1.4)] justify-center">
          {game.dealer.map((c, i) => (
            <div key={c.id} style={{ marginLeft: i ? "-22px" : 0 }}>
              <CardView card={c} hidden={i === 1 && game.holeHidden} delay={initial ? (i === 0 ? 120 : 360) : 0} />
            </div>
          ))}
        </div>
      </section>

      {/* felt print */}
      <div className="pointer-events-none relative my-1 select-none sm:my-3" aria-hidden="true">
        <svg viewBox="0 0 600 70" className="mx-auto block w-full max-w-xl">
          <defs>
            <path id="arc" d="M 40 62 Q 300 -6 560 62" />
          </defs>
          <text fill="rgb(var(--brass) / 0.85)" fontFamily="Marcellus, Georgia, serif" fontSize="21" letterSpacing="5">
            <textPath href="#arc" startOffset="50%" textAnchor="middle">
              BLACKJACK PAYS 3 TO 2
            </textPath>
          </text>
        </svg>
        <div className="-mt-1 text-center font-display text-[0.7rem] uppercase tracking-[0.3em] text-brasssoft/55">
          Dealer must stand on all 17s · Insurance not offered
        </div>
      </div>

      <div className="relative mb-3 grid min-h-[1.75rem] place-items-center">
        {game.note && (
          <div key={game.note + game.shoe.length} className="pop rounded-full bg-black/35 px-4 py-1 text-sm text-ivory/90">
            {game.note}
          </div>
        )}
      </div>

      {/* player */}
      <section className="relative flex flex-wrap items-end justify-center gap-x-8 gap-y-6" aria-label="Your hands">
        {game.hands.length === 0 && (
          <div className="grid h-[calc(clamp(56px,13vw,84px)*1.4+56px)] place-items-center text-center">
            <div className="rounded-full border-2 border-dashed border-brass/40 px-6 py-4 font-display text-brasssoft/70">
              Place your bet and deal
            </div>
          </div>
        )}
        {game.hands.map((h, hi) => {
          const active = game.phase === "player" && hi === game.active;
          const natural = !h.fromSplit && h.cards.length === 2 && handValue(h.cards).total === 21;
          return (
            <div
              key={hi}
              className={`grid justify-items-center gap-2 rounded-2xl px-3 pb-2 pt-3 transition ${
                active && game.hands.length > 1 ? "bg-black/20 ring-2 ring-brass/80" : ""
              }`}
            >
              <div className="flex justify-center">
                {h.cards.map((c, i) => (
                  <div key={c.id} style={{ marginLeft: i ? "-30px" : 0, marginTop: i ? `${-i * 0}px` : 0 }}>
                    <CardView card={c} delay={initial && hi === 0 ? (i === 0 ? 0 : 240) : 0} />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <TotalBadge text={totalText(h.cards, natural)} />
                <span className="inline-flex items-center gap-1 font-mono text-xs text-ivory/80 tnum">
                  <span className="chip inline-block h-4 w-4" style={{ ["--chip" as string]: "rgb(var(--oxblood))" }} />
                  {h.bet}
                  {h.doubled && <span className="text-brasssoft">×2</span>}
                </span>
                {h.outcome && <Outcome o={h.outcome} net={h.net ?? 0} />}
              </div>
            </div>
          );
        })}
      </section>

      {game.phase === "over" && game.roundNet !== null && (
        <div className="pop relative mt-4 text-center">
          <span className={`font-display text-2xl ${game.roundNet > 0 ? "text-good" : game.roundNet < 0 ? "text-bad" : "text-ivory"}`}>
            {game.roundNet > 0 ? "You win " : game.roundNet < 0 ? "You lose " : "Push"}
            {game.roundNet !== 0 && <span className="font-mono text-xl">{Math.abs(game.roundNet)}</span>}
          </span>
        </div>
      )}
    </div>
  );
}

function TotalBadge({ text }: { text: string }) {
  return <span className="pop rounded-full bg-black/45 px-2.5 py-0.5 font-mono text-sm text-ivory tnum">{text}</span>;
}

function Outcome({ o, net }: { o: string; net: number }) {
  const map: Record<string, [string, string]> = {
    blackjack: ["Blackjack", "bg-brass text-ink"],
    win: ["Win", "bg-good text-ink"],
    push: ["Push", "bg-ivory/80 text-ink"],
    lose: ["Lose", "bg-bad text-ink"],
    bust: ["Bust", "bg-bad text-ink"],
  };
  const [t, c] = map[o];
  return (
    <span className={`pop rounded-full px-2.5 py-0.5 text-xs font-bold ${c}`}>
      {t} {net !== 0 && <span className="font-mono">{signed(net)}</span>}
    </span>
  );
}

function Controls({
  game,
  info,
  learn,
  hintsFirst,
  onAct,
  onDeal,
  onBet,
}: {
  game: GameState;
  info: ReturnType<typeof decisionInfo>;
  learn: boolean;
  hintsFirst: boolean;
  onAct: (a: Action) => void;
  onDeal: () => void;
  onBet: (v: number) => void;
}) {
  const canDeal = game.phase === "idle" || game.phase === "over";
  if (canDeal)
    return (
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5" role="radiogroup" aria-label="Bet size">
          <span className="label mr-1">Bet</span>
          {CHIPS.map((c) => (
            <button
              key={c.v}
              role="radio"
              aria-checked={game.bet === c.v}
              onClick={() => onBet(c.v)}
              className={`chip grid h-12 w-12 place-items-center font-mono text-xs font-bold text-ivory transition ${
                game.bet === c.v ? "-translate-y-1 ring-2 ring-brass ring-offset-2 ring-offset-bg" : "opacity-80 hover:opacity-100"
              }`}
              style={{ ["--chip" as string]: c.c }}
            >
              <span className="rounded-full bg-black/40 px-1.5 py-0.5">{c.v}</span>
            </button>
          ))}
        </div>
        <button
          onClick={onDeal}
          autoFocus
          className="rounded-xl bg-brass px-8 py-3.5 font-display text-lg tracking-wide text-ink shadow-lg transition hover:bg-brasssoft active:translate-y-px"
        >
          {game.phase === "idle" ? "Deal" : "New hand"}
        </button>
      </div>
    );

  const best = learn && hintsFirst && info ? info.rec.action : null;
  const btn = (a: Action, enabled: boolean, key: string) => (
    <button
      key={a}
      onClick={() => onAct(a)}
      disabled={!enabled}
      className={`relative min-w-0 rounded-xl px-3 py-3.5 text-base font-bold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-30 ${
        best === a ? "best bg-brass text-ink" : "border border-line bg-panel text-ivory hover:border-brass"
      }`}
    >
      {best === a && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-[0.6rem] uppercase tracking-widest text-brass">
          Book play
        </span>
      )}
      {ACTION_LABEL[a]}
      <span className={`ml-1.5 font-mono text-[0.7rem] ${best === a ? "text-ink/60" : "text-muted"}`}>{key}</span>
    </button>
  );
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {btn("hit", !!info, "H")}
      {btn("stand", !!info, "S")}
      {btn("double", !!info?.canDouble, "D")}
      {btn("split", !!info?.canSplit, "P")}
      {game.phase === "dealer" && <div className="col-span-full text-center text-sm text-muted">Dealer plays…</div>}
    </div>
  );
}

function TestPanel({ session }: { session: Session }) {
  return (
    <div className="grid gap-4">
      <h2 className="font-display text-xl text-brasssoft">Test in progress</h2>
      <div className="rounded-xl border border-line bg-panel p-4 text-sm leading-relaxed text-ivory/85">
        No hints, no chart. Every decision is checked silently against basic strategy. Play as many hands as you like,
        then press <span className="font-semibold text-brasssoft">Finish session</span> for your score and a review of
        each mistake.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Box label="Decisions" value={String(session.decisions.length)} />
        <Box label="Hands" value={String(session.rounds)} />
        <Box label="Blackjacks" value={String(session.blackjacks)} />
        <Box label="Net chips" value={signed(session.net)} />
      </div>
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-3 py-2.5">
      <div className="label">{label}</div>
      <div className="font-mono text-xl tnum">{value}</div>
    </div>
  );
}
