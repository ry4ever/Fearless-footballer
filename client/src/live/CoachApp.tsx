import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Check, ChevronRight, Copy, Plus, X } from "lucide-react";
import type { CoachAthleteDetail, CoachSquadResponse } from "@shared/types";
import { FearlessWordmark } from "../components/icons/CustomIcons";
import { apiClient } from "../lib/apiClient";
import { AccountActions } from "./AccountActions";
import { CoachInvites } from "./CoachInvites";
import { LoadState } from "./LiveHQScreen";
import { lastSevenDayLabels } from "./useAthleteData";
import "./coach.css";

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * The coach's side of the app: their squad code, the players who've joined
 * (once a parent approves), each player's progress and the plan the coach
 * sets for them.
 */
export function CoachApp() {
  const [openLinkId, setOpenLinkId] = useState<string | null>(null);
  return openLinkId ? (
    <CoachAthleteScreen linkId={openLinkId} onBack={() => setOpenLinkId(null)} />
  ) : (
    <CoachSquadScreen onOpen={setOpenLinkId} />
  );
}

function CoachSquadScreen({ onOpen }: { onOpen: (linkId: string) => void }) {
  const [squad, setSquad] = useState<CoachSquadResponse | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setSquad(await apiClient.getCoachSquad());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't load your squad.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!squad) return <LoadState error={error} onRetry={() => void load()} label="Loading your squad…" />;

  const active = squad.athletes.filter((athlete) => athlete.status === "active");
  const pending = squad.athletes.filter((athlete) => athlete.status === "pending_parent");

  async function copyCode() {
    if (!squad) return;
    try {
      await navigator.clipboard.writeText(squad.squadCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the code is on screen to copy by hand.
    }
  }

  return (
    <div className="screen hq2-screen co-screen">
      <div className="hq2-glow" aria-hidden="true" />
      <header className="hq2-header">
        <FearlessWordmark />
        <span className="co-badge">COACH</span>
      </header>
      <section className="hq2-hello">
        <p>{squad.coachName}</p>
        <h1>
          Your <span>Squad</span>
        </h1>
        <span className="hq2-method">SEE | REHEARSE | BECOME</span>
      </section>

      <section className="hq2-card co-code" aria-label="Squad code">
        <span className="hq2-eyebrow">YOUR SQUAD CODE</span>
        <div className="co-code-row">
          <strong>{squad.squadCode}</strong>
          <button type="button" className="co-copy" onClick={() => void copyCode()} aria-label="Copy squad code">
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
        <p>
          Players enter this in their app under <b>More → Your coach</b>. Their parent or guardian approves before
          you see their training. You'll never see their reflections.
        </p>
      </section>

      <section aria-label="Players">
        <span className="hq2-eyebrow hq2-section-label">
          PLAYERS {active.length > 0 && `· ${active.length}`}
        </span>
        {active.length === 0 ? (
          <div className="hq2-card">
            <p className="live-copy">No players yet. Share your squad code to get started.</p>
          </div>
        ) : (
          <div className="hq2-rows">
            {active.map((athlete) => (
              <button key={athlete.linkId} type="button" className="co-player" onClick={() => onOpen(athlete.linkId)}>
                <span className="co-avatar" aria-hidden="true">
                  {athlete.athleteName.charAt(0).toUpperCase()}
                </span>
                <span className="co-player-text">
                  <strong>{athlete.athleteName}</strong>
                  <small>
                    {athlete.totalCompletions ?? 0} {plural(athlete.totalCompletions ?? 0, "session", "sessions")}
                    {athlete.lastSessionAt ? ` · last ${formatDay(athlete.lastSessionAt)}` : ""}
                  </small>
                </span>
                {athlete.hasPlan ? <span className="co-tag">PLAN SET</span> : <span className="co-tag muted">NO PLAN</span>}
                <ChevronRight size={18} className="co-chevron" />
              </button>
            ))}
          </div>
        )}
      </section>

      {pending.length > 0 && (
        <section aria-label="Waiting for a parent">
          <span className="hq2-eyebrow hq2-section-label">WAITING FOR A PARENT TO APPROVE</span>
          <div className="hq2-rows">
            {pending.map((athlete) => (
              <div key={athlete.linkId} className="co-player pending">
                <span className="co-avatar" aria-hidden="true">
                  {athlete.athleteName.charAt(0).toUpperCase()}
                </span>
                <span className="co-player-text">
                  <strong>{athlete.athleteName}</strong>
                  <small>Asked to join {formatDay(athlete.requestedAt)}</small>
                </span>
                <button
                  type="button"
                  className="co-icon-button"
                  aria-label={`Remove ${athlete.athleteName}'s request`}
                  onClick={async () => {
                    await apiClient.removeFromSquad(athlete.linkId).catch(() => undefined);
                    void load();
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {squad.canInviteCoaches && <CoachInvites />}

      <AccountActions />
    </div>
  );
}

function CoachAthleteScreen({ linkId, onBack }: { linkId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<CoachAthleteDetail | null>(null);
  const [plan, setPlan] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const next = await apiClient.getCoachAthlete(linkId);
      setDetail(next);
      setPlan(next.plan.sessionIds);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't load this player.");
    }
  }, [linkId]);
  useEffect(() => {
    void load();
  }, [load]);

  const byId = useMemo(() => new Map((detail?.sessions ?? []).map((session) => [session.id, session])), [detail]);
  if (!detail) return <LoadState error={error} onRetry={() => void load()} label="Loading player…" />;

  const changed = plan.join() !== detail.plan.sessionIds.join();
  const available = detail.sessions.filter((session) => !plan.includes(session.id));
  const { progress } = detail;
  const topArea = progress.completionsByArea[0]?.count ?? 1;
  const dayLabels = lastSevenDayLabels();

  const move = (index: number, by: number) => {
    setSaved(false);
    setPlan((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item!);
      return next;
    });
  };

  async function save() {
    setSaving(true);
    setError("");
    try {
      const result = await apiClient.setCoachPlan(linkId, plan);
      setDetail((current) => (current ? { ...current, plan: { sessionIds: result.sessionIds, updatedAt: result.updatedAt } } : current));
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't save the plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="screen hq2-screen co-screen">
      <div className="hq2-glow" aria-hidden="true" />
      <header className="co-top">
        <button type="button" className="ps-back co-back" onClick={onBack} aria-label="Back to your squad">
          <ArrowLeft size={20} />
        </button>
        <FearlessWordmark height={22} />
        <span className="co-back-spacer" aria-hidden="true" />
      </header>
      <section className="hq2-hello">
        <p>Player</p>
        <h1>{detail.athleteName}</h1>
      </section>

      <div className="co-stats">
        <div className="hq2-card">
          <strong>{progress.totalCompletions}</strong>
          <span>{plural(progress.totalCompletions, "session", "sessions")} completed</span>
        </div>
        <div className="hq2-card">
          <strong>{progress.consecutiveWeeks}</strong>
          <span>{plural(progress.consecutiveWeeks, "week", "weeks")} consistent</span>
        </div>
        <div className="hq2-card">
          <strong>{progress.currentStreakDays}</strong>
          <span>day streak</span>
        </div>
      </div>

      <section className="hq2-card" aria-label="Last 7 days">
        <div className="hq2-row">
          <span className="hq2-eyebrow">LAST 7 DAYS</span>
          {progress.lastSession && (
            <small className="hq2-meta">
              Last: {progress.lastSession.title} · {formatDay(progress.lastSession.completedAt)}
            </small>
          )}
        </div>
        <div className="hq2-days hq2-days-wide" aria-label={`${progress.weeklyCompletedDays} of the last 7 days trained`}>
          {progress.sevenDayPattern.map((done, index) => (
            <span key={index} className={done ? "done" : ""}>
              <i />
              {dayLabels[index]}
            </span>
          ))}
        </div>
      </section>

      <section className="hq2-card" aria-label="Areas worked on">
        <span className="hq2-eyebrow">AREAS WORKED ON</span>
        {progress.completionsByArea.length === 0 ? (
          <p className="pr-note">Nothing yet – areas show up once they complete a session.</p>
        ) : (
          <ul className="pr-areas">
            {progress.completionsByArea.map(({ area, count }) => (
              <li key={area}>
                <div className="hq2-row">
                  <strong>{area}</strong>
                  <span className="hq2-meta">
                    {count} {plural(count, "session", "sessions")}
                  </span>
                </div>
                <span className="hq2-bar" aria-hidden="true">
                  <span style={{ width: `${(count / topArea) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="hq2-card co-plan" aria-label="Training plan">
        <span className="hq2-eyebrow">{detail.athleteName.toUpperCase()}'S PLAN</span>
        <p className="co-plan-intro">
          Pick sessions and put them in order. Their Home screen shows the next one they haven't done.
        </p>
        {plan.length === 0 ? (
          <p className="pr-note">No plan yet – they'll follow the programme they chose. Add sessions below.</p>
        ) : (
          <ol className="co-plan-list">
            {plan.map((id, index) => {
              const session = byId.get(id);
              return (
                <li key={id}>
                  <span className="co-plan-number">{index + 1}</span>
                  <span className="co-plan-text">
                    <strong>{session?.title ?? "Session no longer available"}</strong>
                    {session?.focusArea && <small>{session.focusArea}</small>}
                  </span>
                  <button type="button" className="co-icon-button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up">
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="co-icon-button"
                    disabled={index === plan.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label="Move down"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    className="co-icon-button"
                    onClick={() => {
                      setSaved(false);
                      setPlan((current) => current.filter((item) => item !== id));
                    }}
                    aria-label={`Remove ${session?.title ?? "session"}`}
                  >
                    <X size={16} />
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        {available.length > 0 && (
          <>
            <span className="hq2-eyebrow co-add-label">ADD A SESSION</span>
            <ul className="co-available">
              {available.map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSaved(false);
                      setPlan((current) => [...current, session.id]);
                    }}
                  >
                    <Plus size={16} />
                    <span>
                      <strong>{session.title}</strong>
                      {session.tagline && <small>{session.tagline}</small>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {error && (
          <div className="live-error" role="alert">
            {error}
          </div>
        )}
        <button type="button" className="pg-choose" disabled={!changed || saving} onClick={() => void save()}>
          {saving ? "Saving…" : plan.length === 0 && detail.plan.sessionIds.length > 0 ? "Clear plan" : "Save plan"}
        </button>
        {saved && !changed && (
          <p className="pg-current" role="status">
            <Check size={18} /> Saved. {detail.athleteName} will see it next time they open the app.
          </p>
        )}
      </section>

      <section className="co-remove">
        {confirmRemove ? (
          <div className="live-button-row">
            <p className="live-copy">Remove {detail.athleteName} from your squad? You'll lose access to their progress and their plan ends.</p>
            <button
              type="button"
              className="live-danger-button"
              onClick={async () => {
                await apiClient.removeFromSquad(linkId).catch(() => undefined);
                onBack();
              }}
            >
              Yes, remove
            </button>
            <button type="button" className="live-link-button" onClick={() => setConfirmRemove(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="live-link-button" onClick={() => setConfirmRemove(true)}>
            Remove from squad
          </button>
        )}
      </section>
    </div>
  );
}
