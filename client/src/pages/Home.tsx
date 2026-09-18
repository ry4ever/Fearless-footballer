import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bookmark,
  Brain,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Flame,
  Headphones,
  Home as HomeIcon,
  LockKeyhole,
  MessageCircle,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";

type Screen = "hq" | "setup" | "player" | "complete" | "parent";
type Mode = "interactive" | "guidance" | "relaxation";

const heroImage = "/manus-storage/fearless-hq-wireframe-v2_c79d9b43.png";
const sessionImage = "/manus-storage/fearless-session-execution-wireframe_a785159f.png";

const modeOptions: Array<{
  id: Mode;
  label: string;
  eyebrow: string;
  body: string;
  duration: string;
  icon: typeof Target;
}> = [
  {
    id: "interactive",
    label: "Interactive",
    eyebrow: "COACH WITH ME",
    body: "Short prompts and choices keep you engaged between phases.",
    duration: "5 min",
    icon: Target,
  },
  {
    id: "guidance",
    label: "Full Guidance",
    eyebrow: "FOLLOW THE VOICE",
    body: "A calm, continuous walkthrough from first breath to final play.",
    duration: "8 min",
    icon: Headphones,
  },
  {
    id: "relaxation",
    label: "Relaxation",
    eyebrow: "RESET YOUR SYSTEM",
    body: "Slower pacing, spacious silence, and a softer matchday landing.",
    duration: "10 min",
    icon: Sparkles,
  },
];

const modeCopy: Record<Mode, { prompt: string; sub: string; phaseLabels: string[] }> = {
  interactive: {
    prompt: "Name the first action you want available under pressure.",
    sub: "Choose one simple cue. We’ll rehearse it together.",
    phaseLabels: ["Center", "Choose", "Rehearse"],
  },
  guidance: {
    prompt: "Let the voice lead. Notice your breath, your body, and the next play.",
    sub: "You don’t need to decide anything until the session asks.",
    phaseLabels: ["Arrive", "Reframe", "Rehearse"],
  },
  relaxation: {
    prompt: "Slow the moment down. You are allowed to arrive before you perform.",
    sub: "A quieter reset for the space before the match.",
    phaseLabels: ["Settle", "Release", "Reset"],
  },
};

function BrandMark() {
  return (
    <div className="brand-lockup" aria-label="Fearless Footballer">
      <span>FEAR</span><span className="brand-cut">A</span><span>LESS</span>
      <small>FOOTBALLER</small>
    </div>
  );
}

function NavBar({ active, onNavigate }: { active: string; onNavigate: (key: string) => void }) {
  const items = [
    { id: "hq", label: "HQ", icon: HomeIcon },
    { id: "reps", label: "Reps", icon: Zap },
    { id: "vault", label: "Vault", icon: LockKeyhole },
    { id: "feed", label: "Feed", icon: MessageCircle },
    { id: "profile", label: "Profile", icon: UserRound },
  ];
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`nav-item ${active === id ? "active" : ""}`}
          onClick={() => onNavigate(id)}
          aria-label={label}
        >
          <Icon size={21} strokeWidth={active === id ? 2.5 : 1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function MetricCard({ type }: { type: "score" | "streak" }) {
  const score = type === "score";
  return (
    <div className={`metric-card ${score ? "cyan-edge" : "purple-edge"}`}>
      <div className="metric-icon">{score ? <Brain size={25} /> : <Flame size={27} />}</div>
      <div className="metric-copy">
        <span className="eyebrow">{score ? "COMPOSURE SCORE" : "CURRENT STREAK"}</span>
        <strong>{score ? "—" : "0/1"}</strong>
        <small>{score ? "Build your baseline." : "Complete a session to start."}</small>
      </div>
      <CircleHelp className="metric-help" size={16} />
    </div>
  );
}

function HQScreen({ onStart, onSetup, onParent, onNavigate }: { onStart: () => void; onSetup: () => void; onParent: () => void; onNavigate: (key: string) => void }) {
  const [day, setDay] = useState("MON");
  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  return (
    <div className="screen hq-screen">
      <div className="hero-wash" />
      <header className="hq-header">
        <BrandMark />
        <div className="header-actions"><button className="parent-entry" onClick={onParent}><Users size={15} /> Parent view</button><button className="icon-button" aria-label="Notifications"><Bell size={22} /></button></div>
      </header>
      <section className="greeting">
        <span className="eyebrow">GOOD EVENING,</span>
        <h1>Alex</h1>
      </section>
      <section className="metrics-grid" aria-label="Performance metrics">
        <MetricCard type="score" />
        <MetricCard type="streak" />
      </section>
      <section className="rep-card" aria-label="Today's Fearless Rep">
        <div className="rep-cover" style={{ backgroundImage: `linear-gradient(90deg, rgba(7,20,49,.98) 0%, rgba(7,20,49,.8) 42%, rgba(7,20,49,.1) 100%), url(${heroImage})` }} />
        <div className="rep-content">
          <span className="eyebrow">TODAY’S FEARLESS REP</span>
          <h2>Nerves =<br />Performance</h2>
          <div className="rep-meta"><span><CircleHelp size={16} /> 5 min</span><span><Brain size={16} /> Composure</span></div>
          <p>Turn adrenaline into information.</p>
          <button className="primary-button" onClick={onStart}>Start rehearsal <ArrowRight size={19} /></button>
        </div>
        <div className="rep-check"><Check size={15} /></div>
      </section>
      <section className="blueprint-section">
        <div className="section-row">
          <div><span className="eyebrow">7-DAY BLUEPRINT</span><h3>Your starting rhythm</h3></div>
          <div className="mode-pill"><span><Target size={14} /> Recommended</span><button onClick={onSetup}><Settings2 size={14} /> Customize</button></div>
        </div>
        <div className="days-row" role="tablist" aria-label="Blueprint days">
          {days.map((item, index) => (
            <button key={item} className={`day-button ${day === item ? "selected" : ""}`} onClick={() => setDay(item)} role="tab" aria-selected={day === item}>
              {index === 0 && day !== "MON" ? <Check size={13} /> : <span className="day-dot" />}
              <b>{item}</b>
              <small>{index === 0 ? "5m" : index === 2 ? "Rest" : "—"}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="mentor-card">
        <div className="mentor-avatar">AM</div>
        <div><span className="eyebrow">MENTOR SHORTCUT</span><h3>Presence under pressure</h3><p>One cue from Alex Rivera</p></div>
        <button className="circle-arrow" aria-label="Open mentor shortcut"><ChevronRight size={19} /></button>
      </section>
      <NavBar active="hq" onNavigate={onNavigate} />
    </div>
  );
}


function ParentDashboard({ onBack, onNavigate }: { onBack: () => void; onNavigate: (key: string) => void }) {
  return (
    <div className="screen parent-screen">
      <div className="parent-glow" />
      <header className="parent-header">
        <button className="back-button parent-back" onClick={onBack} aria-label="Back to Fearless HQ"><ArrowLeft size={22} /></button>
        <div className="parent-title"><span className="eyebrow">CAREGIVER VIEW</span><strong>Parent dashboard</strong></div>
        <button className="icon-button parent-settings" aria-label="Parent dashboard settings"><Settings2 size={19} /></button>
      </header>
      <main className="parent-content">
        <section className="athlete-identity"><div className="athlete-avatar">AR</div><div><span className="eyebrow">ATHLETE</span><h1>Alex Rivera</h1><p>Matchday mindset · Week 1</p></div><span className="status-dot"><span /> Active</span></section>
        <section className="parent-summary-card"><div className="summary-heading"><div><span className="eyebrow">THIS WEEK</span><h2>Building composure</h2></div><CalendarDays size={22} /></div><div className="completion-row"><div className="completion-ring"><strong>5/7</strong><span>days</span></div><div><strong>Consistent rhythm</strong><p>Alex has completed five mindset reps this week.</p><div className="completion-dots">{[1, 1, 1, 1, 1, 0, 0].map((done, index) => <span className={done ? "done" : ""} key={index} />)}</div></div></div></section>
        <section className="parent-metrics-grid" aria-label="Athlete progress metrics">
          <div className="parent-metric mint"><div className="parent-metric-icon"><Sparkles size={19} /></div><span className="eyebrow">MOOD TREND</span><strong>Improving</strong><small>More settled after reps</small><div className="trend-line"><span /><span /><span /><span /><span /></div></div>
          <div className="parent-metric violet"><div className="parent-metric-icon"><Brain size={19} /></div><span className="eyebrow">COMPOSURE</span><strong>82</strong><small>+8 this week</small><div className="score-bar"><span /></div></div>
          <div className="parent-metric blue"><div className="parent-metric-icon"><Flame size={19} /></div><span className="eyebrow">CURRENT STREAK</span><strong>4 days</strong><small>Best: 5 days</small><div className="streak-dots"><span /><span /><span /><span /><span /><span /></div></div>
          <div className="parent-metric coral"><div className="parent-metric-icon"><Headphones size={19} /></div><span className="eyebrow">LAST REP</span><strong>5 min</strong><small>Nerves = Performance</small><span className="last-rep-label">Completed today</span></div>
        </section>
        <section className="conversation-section"><div className="section-row"><div><span className="eyebrow">CONVERSATION STARTERS</span><h2>Open the door, don’t grade the rep.</h2></div><MessageCircle size={22} /></div>
          <div className="conversation-card featured"><div className="conversation-icon"><MessageCircle size={21} /></div><div><span className="eyebrow">TRY THIS TONIGHT</span><strong>“What helped you reset today?”</strong><p>Invite a story, not a score.</p></div><ChevronRight size={18} /></div>
          <div className="conversation-card"><div className="conversation-icon secondary"><Trophy size={20} /></div><div><span className="eyebrow">NOTICE THE EFFORT</span><strong>“I noticed you made time for your rep.”</strong><p>Reinforce consistency over outcome.</p></div><ChevronRight size={18} /></div>
          <div className="conversation-card"><div className="conversation-icon blue-icon"><Zap size={20} /></div><div><span className="eyebrow">BEFORE MATCHDAY</span><strong>“Which cue do you want to carry with you?”</strong><p>Help Alex choose their own anchor.</p></div><ChevronRight size={18} /></div>
        </section>
        <section className="parent-note"><div className="note-icon"><LockKeyhole size={17} /></div><p>Private by design. This view shares progress patterns, not session transcripts or answers.</p></section>
      </main>
      <NavBar active="profile" onNavigate={onNavigate} />
    </div>
  );
}

function SetupScreen({ mode, setMode, music, setMusic, onBack, onStart }: { mode: Mode; setMode: (m: Mode) => void; music: boolean; setMusic: (v: boolean) => void; onBack: () => void; onStart: () => void }) {
  const selected = modeOptions.find((item) => item.id === mode)!;
  return (
    <div className="screen setup-screen">
      <div className="setup-top-glow" />
      <header className="setup-header">
        <button className="back-button" onClick={onBack} aria-label="Back to HQ"><ArrowLeft size={22} /></button>
        <BrandMark />
        <button className="icon-button" aria-label="Bookmark session"><Bookmark size={20} /></button>
      </header>
      <main className="setup-content">
        <span className="eyebrow">MATCHDAY STATE</span>
        <h1>Unshakeable</h1>
        <p className="setup-subtitle">Stay locked onto your game, whatever they try.</p>
        <div className="prep-card">
          <h3>Before you start</h3>
          <ul>
            <li>Bring to mind the opponent.</li>
            <li>Notice their routine — the mouth, the fouling.</li>
            <li>Choose one recent game where it happened.</li>
          </ul>
        </div>
        <div className="control-group">
          <div className="control-label"><span>Mode</span><small>Choose how you want to be coached.</small></div>
          <div className="mode-grid" role="radiogroup" aria-label="Session mode">
            {modeOptions.map(({ id, label, eyebrow, body, duration, icon: Icon }) => (
              <button key={id} className={`mode-card ${mode === id ? "selected" : ""}`} onClick={() => setMode(id)} role="radio" aria-checked={mode === id}>
                <div className="mode-icon"><Icon size={18} /></div>
                <div className="mode-card-copy"><span>{label}</span><small>{eyebrow}</small><p>{body}</p></div>
                <b>{duration}</b>
              </button>
            ))}
          </div>
        </div>
        <div className="music-row">
          <div className="music-symbol">{music ? <Music2 size={20} /> : <VolumeX size={20} />}</div>
          <div><span>Background music</span><small>{music ? "Atmospheric stadium bed enabled" : "Voice and silence only"}</small></div>
          <button className={`switch ${music ? "on" : ""}`} onClick={() => setMusic(!music)} aria-pressed={music} aria-label="Toggle background music"><span /></button>
        </div>
        <button className="primary-button start-button" onClick={onStart}>Start · {selected.duration}<ArrowRight size={19} /></button>
        <button className="text-link"><CircleHelp size={15} /> Why this works · 6 min</button>
      </main>
    </div>
  );
}

function PlayerScreen({ mode, music, onBack, onComplete }: { mode: Mode; music: boolean; onBack: () => void; onComplete: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);
  const copy = modeCopy[mode];
  const duration = mode === "interactive" ? 300 : mode === "guidance" ? 480 : 600;
  const timeLabel = useMemo(() => {
    const seconds = Math.floor((progress / 100) * duration);
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }, [duration, progress]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setProgress((value) => {
        const next = Math.min(100, value + 1.2);
        if (next >= 100) setPlaying(false);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing]);
  useEffect(() => setPhase(progress >= 66 ? 2 : progress >= 33 ? 1 : 0), [progress]);
  return (
    <div className="screen player-screen" style={{ backgroundImage: `linear-gradient(180deg, rgba(7,10,32,.38), rgba(7,10,32,.9) 76%), url(${sessionImage})` }}>
      <header className="player-header">
        <button className="back-button" onClick={onBack} aria-label="Leave session"><ArrowLeft size={23} /></button>
        <span className="player-label">SESSION PLAYER</span>
        <button className="icon-button" aria-label="Save session"><Bookmark size={20} /></button>
      </header>
      <main className="player-content">
        <span className="eyebrow">COMPOSURE · {modeOptions.find((x) => x.id === mode)?.label.toUpperCase()}</span>
        <h1>Nerves =<br />Performance</h1>
        <div className="player-mentor"><div className="mentor-avatar small">AR</div><div><strong>Alex Rivera</strong><span>FOOTBALL MENTOR · {modeOptions.find((x) => x.id === mode)?.duration}</span></div></div>
        <div className="phase-track" aria-label="Session phases">
          {copy.phaseLabels.map((label, index) => <div className={`phase ${index <= phase ? "active" : ""}`} key={label}><span>{index + 1}</span><small>{label}</small></div>)}
        </div>
        <button className="play-or-pause" onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause session" : "Play session"}>{playing ? <Pause size={39} fill="currentColor" /> : <Play size={39} fill="currentColor" />}</button>
        <div className="timeline-wrap"><div className="timeline"><span style={{ width: `${progress}%` }} /><button style={{ left: `${progress}%` }} aria-label="Session progress" /></div><div className="timeline-labels"><span>{timeLabel}</span><span>{modeOptions.find((x) => x.id === mode)?.duration}</span></div></div>
        <div className="prompt-block"><strong>{copy.prompt}</strong><span>{copy.sub}</span></div>
        <div className="transport"><button aria-label="Skip back 15 seconds" onClick={() => setProgress(Math.max(0, progress - 5))}><RotateCcw size={18} /><small>15</small></button><button className="transport-main" onClick={() => setPlaying(!playing)}>{playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}</button><button aria-label="Skip forward 15 seconds" onClick={() => setProgress(Math.min(100, progress + 5))}><RotateCcw className="flip" size={18} /><small>15</small></button></div>
        <div className="player-status"><Headphones size={16} /><span>{music ? "MUSIC ON · HEADPHONES RECOMMENDED" : "MUSIC OFF · VOICE + SILENCE"}</span>{music ? <Volume2 size={16} /> : <VolumeX size={16} />}</div>
        <div className="finish-card"><div className="finish-top"><Trophy size={18} /><span>AT THE END OF THIS SESSION</span></div><strong>Finish strong</strong><p>Complete the rep to update your streak and build your baseline.</p><button onClick={onComplete}><Check size={16} /> Finish session</button></div>
      </main>
    </div>
  );
}

function CompleteScreen({ onHome }: { onHome: () => void }) {
  return (
    <div className="screen complete-screen">
      <div className="complete-glow" />
      <main className="complete-content">
        <div className="success-ring"><Check size={35} /></div>
        <span className="eyebrow">SESSION COMPLETE</span>
        <h1>You showed up<br />today.</h1>
        <p>One rep closer to playing your next game with intent.</p>
        <div className="complete-stats"><div><strong>1</strong><span>rep complete</span></div><div><strong>1 day</strong><span>current streak</span></div><div><strong>+ baseline</strong><span>composure update</span></div></div>
        <div className="reflection-card"><span className="eyebrow">OPTIONAL REFLECTION</span><h3>How do you feel right now?</h3><div className="reflection-row"><button>Clearer</button><button>Steadier</button><button>More ready</button></div></div>
        <button className="primary-button" onClick={onHome}>Back to Fearless HQ <ArrowRight size={19} /></button>
        <button className="text-link"><MessageCircle size={15} /> Your parent insight is ready after you leave</button>
      </main>
    </div>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("hq");
  const [mode, setMode] = useState<Mode>("interactive");
  const [music, setMusic] = useState(true);
  const [toast, setToast] = useState("");
  const navigate = (key: string) => {
    if (key === "hq") setScreen("hq");
    else { setToast(`${key[0].toUpperCase()}${key.slice(1)} is part of the next prototype pass.`); window.setTimeout(() => setToast(""), 2400); }
  };
  return (
    <div className="prototype-frame">
      <div className="phone-shell">
        {screen === "hq" && <HQScreen onStart={() => setScreen("setup")} onSetup={() => setScreen("setup")} onParent={() => setScreen("parent")} onNavigate={navigate} />}
        {screen === "setup" && <SetupScreen mode={mode} setMode={setMode} music={music} setMusic={setMusic} onBack={() => setScreen("hq")} onStart={() => setScreen("player")} />}
        {screen === "player" && <PlayerScreen mode={mode} music={music} onBack={() => setScreen("setup")} onComplete={() => setScreen("complete")} />}
        {screen === "complete" && <CompleteScreen onHome={() => setScreen("hq")} />}
        {screen === "parent" && <ParentDashboard onBack={() => setScreen("hq")} onNavigate={navigate} />}
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
