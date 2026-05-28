import { type CSSProperties, useEffect, useRef, useState } from "react";

import type {
  AuthStatusPayload,
  DashboardPayload,
  PersonWithNote
} from "../shared/types";

const SPOTLIGHT_STORAGE_KEY = "mas-spotlight-index";
const SPOTLIGHT_ROTATION_INTERVAL_MS = 8000;
const SPARKLE_COUNT = 20;
const BUBBLE_COUNT = 20;
const BEDAZZLE_BURST_COUNT = 100;
const FLAIR_CHIPS = [
  "Pinktopia",
  "Glitterati",
  "Sparkledream",
  "Glossglow",
  "Flutterheart",
  "Pearlpop",
  "Blingverse",
  "Gleamsquad"
] as const;
const BEDAZZLE_TOKENS = {
  star: ["⭐", "🌟", "✨", "💫"],
  animal: ["🦄", "🐎", "🦋", "🐇", "🐣", "🐬"],
  balloon: ["🎈", "🎈", "🎈", "🎉"],
  emoji: ["💖", "💎", "🌈", "🩷", "💘", "💐", "🫧"]
} as const;
const FLYING_CREATURES = [
  { className: "unicorn-flight-one", icon: "🦄" },
  { className: "horse-flight", icon: "🐎" },
  { className: "unicorn-flight-two", icon: "🦄" }
] as const;

type BedazzleBurstKind = keyof typeof BEDAZZLE_TOKENS;

interface BedazzleBurstItem {
  id: string;
  symbol: string;
  kind: BedazzleBurstKind;
  left: number;
  top: number;
  toX: number;
  toY: number;
  size: number;
  duration: number;
  delay: number;
  rotationStart: number;
  rotationEnd: number;
  scale: number;
  opacity: number;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function getNextSpotlightIndex(peopleCount: number) {
  if (peopleCount <= 0) {
    return 0;
  }

  const savedValue = window.localStorage.getItem(SPOTLIGHT_STORAGE_KEY);
  const previousIndex = savedValue ? Number.parseInt(savedValue, 10) : -1;
  const nextIndex = Number.isNaN(previousIndex) ? 0 : (previousIndex + 1) % peopleCount;

  window.localStorage.setItem(SPOTLIGHT_STORAGE_KEY, String(nextIndex));
  return nextIndex;
}

function randomFrom<T>(values: readonly T[]) {
  return values[Math.floor(Math.random() * values.length)];
}

function createBedazzleBurst() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const kinds: BedazzleBurstKind[] = ["star", "animal", "balloon", "emoji"];

  return Array.from({ length: BEDAZZLE_BURST_COUNT }, (_, index): BedazzleBurstItem => {
    const kind = kinds[index % kinds.length];
    const left = viewportWidth * (0.72 + Math.random() * 0.18);
    const top = viewportHeight * (0.18 + Math.random() * 0.18);
    const horizontalTravel = -(viewportWidth * (0.2 + Math.random() * 0.95));
    let verticalTravel = viewportHeight * (Math.random() * 0.92 - 0.32);

    if (kind === "balloon") {
      verticalTravel -= viewportHeight * (0.14 + Math.random() * 0.18);
    }

    return {
      id: `${Date.now()}-${index}`,
      symbol: randomFrom(BEDAZZLE_TOKENS[kind]),
      kind,
      left,
      top,
      toX: horizontalTravel,
      toY: verticalTravel,
      size: 26 + Math.random() * 34,
      duration: 1450 + Math.random() * 1350,
      delay: Math.random() * 260,
      rotationStart: -40 + Math.random() * 80,
      rotationEnd: -220 + Math.random() * 440,
      scale: 0.9 + Math.random() * 0.9,
      opacity: 0.7 + Math.random() * 0.3
    };
  });
}

function App() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatusPayload | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [bedazzleBurst, setBedazzleBurst] = useState<BedazzleBurstItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);
  const burstTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedInError = params.get("linkedin_error");

    if (linkedInError) {
      setError("LinkedIn sign-in did not complete. Please check the app configuration and try again.");
    }

    if (params.has("linkedin") || linkedInError) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    void loadAuthStatus().catch((caughtError: unknown) => {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load LinkedIn authentication status."
      );
    });
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (!dashboard || dashboard.people.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setSpotlightIndex((currentIndex) => {
        const nextIndex = (currentIndex + 1) % dashboard.people.length;
        window.localStorage.setItem(SPOTLIGHT_STORAGE_KEY, String(nextIndex));
        return nextIndex;
      });
      setPulseKey((value) => value + 1);
    }, SPOTLIGHT_ROTATION_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [dashboard]);

  useEffect(() => {
    return () => {
      if (burstTimeoutRef.current !== null) {
        window.clearTimeout(burstTimeoutRef.current);
      }
    };
  }, []);

  async function loadDashboard(forceRefresh = false) {
    try {
      setError(null);
      setIsRefreshing(forceRefresh);

      const response = await fetch(forceRefresh ? "/api/dashboard/refresh" : "/api/dashboard", {
        method: forceRefresh ? "POST" : "GET"
      });

      if (!response.ok) {
        throw new Error("Unable to load appreciation notes.");
      }

      const payload = (await response.json()) as DashboardPayload;
      setDashboard(payload);
      setSpotlightIndex(() => getNextSpotlightIndex(payload.people.length));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Something bright went dim for a moment."
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  async function loadAuthStatus() {
    const response = await fetch("/api/auth/me");

    if (!response.ok) {
      throw new Error("Unable to load LinkedIn authentication status.");
    }

    const payload = (await response.json()) as AuthStatusPayload;
    setAuthStatus(payload);
  }

  function triggerBedazzleBurst() {
    const burstItems = createBedazzleBurst();
    setBedazzleBurst(burstItems);

    if (burstTimeoutRef.current !== null) {
      window.clearTimeout(burstTimeoutRef.current);
    }

    const lastAnimationFrame = Math.max(
      ...burstItems.map((item) => item.duration + item.delay)
    );

    burstTimeoutRef.current = window.setTimeout(() => {
      setBedazzleBurst([]);
      burstTimeoutRef.current = null;
    }, lastAnimationFrame + 180);
  }

  function connectLinkedIn() {
    window.location.assign("/api/auth/linkedin/start");
  }

  async function signOutLinkedIn() {
    try {
      setIsSigningOut(true);

      const response = await fetch("/api/auth/logout", {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("Unable to sign out of LinkedIn.");
      }

      setAuthStatus((currentStatus) =>
        currentStatus
          ? {
              ...currentStatus,
              member: null
            }
          : {
              authEnabled: true,
              member: null
            }
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "LinkedIn sign-out took an unexpected turn."
      );
    } finally {
      setIsSigningOut(false);
    }
  }

  function triggerStarMoment() {
    if (!dashboard || dashboard.people.length === 0) {
      return;
    }

    setSpotlightIndex((currentIndex) => {
      const nextIndex = Math.floor(Math.random() * dashboard.people.length);

      if (dashboard.people.length === 1 || nextIndex !== currentIndex) {
        window.localStorage.setItem(SPOTLIGHT_STORAGE_KEY, String(nextIndex));
        return nextIndex;
      }

      const fallbackIndex = (currentIndex + 1) % dashboard.people.length;
      window.localStorage.setItem(SPOTLIGHT_STORAGE_KEY, String(fallbackIndex));
      return fallbackIndex;
    });
    setPulseKey((value) => value + 1);
  }

  async function handleBedazzleRefresh() {
    triggerBedazzleBurst();
    await loadDashboard(true);
  }

  const spotlightPerson: PersonWithNote | null =
    dashboard && dashboard.people.length > 0 ? dashboard.people[spotlightIndex] : null;

  return (
    <div className="page-shell">
      <div className="sky-ribbons" aria-hidden="true">
        <span className="sky-ribbon ribbon-pink" />
        <span className="sky-ribbon ribbon-yellow" />
        <span className="sky-ribbon ribbon-green" />
      </div>
      <div className="floating-blob blob-pink" />
      <div className="floating-blob blob-yellow" />
      <div className="floating-blob blob-green" />
      <div className="sparkle-field" aria-hidden="true">
        {Array.from({ length: SPARKLE_COUNT }, (_, index) => (
          <span key={`sparkle-${index}`} />
        ))}
      </div>
      <div className="bubble-stream bubble-left" aria-hidden="true">
        {Array.from({ length: BUBBLE_COUNT }, (_, index) => (
          <span key={`bubble-left-${index}`} />
        ))}
      </div>
      <div className="bubble-stream bubble-right" aria-hidden="true">
        {Array.from({ length: BUBBLE_COUNT }, (_, index) => (
          <span key={`bubble-right-${index}`} />
        ))}
      </div>
      <div className="balloon-cluster" aria-hidden="true">
        <span className="balloon balloon-pink" />
        <span className="balloon balloon-yellow" />
        <span className="balloon balloon-green" />
        <span className="balloon balloon-coral" />
        <span className="balloon balloon-sun" />
      </div>
      <div className="sparkle-row">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="rainbow-unicorn" aria-hidden="true">
        <span className="rainbow-unicorn-body">
          <span className="unicorn-tail" />
          <span className="unicorn-wing" />
          <span className="unicorn-torso" />
          <span className="unicorn-neck" />
          <span className="unicorn-head">
            <span className="unicorn-ear unicorn-ear-back" />
            <span className="unicorn-ear unicorn-ear-front" />
            <span className="unicorn-eye" />
            <span className="unicorn-horn" />
            <span className="unicorn-mane" />
          </span>
          <span className="unicorn-leg unicorn-leg-one" />
          <span className="unicorn-leg unicorn-leg-two" />
          <span className="unicorn-leg unicorn-leg-three" />
          <span className="unicorn-leg unicorn-leg-four" />
        </span>
        <span className="rainbow-trail">
          <span className="rainbow-band rainbow-red" />
          <span className="rainbow-band rainbow-orange" />
          <span className="rainbow-band rainbow-yellow" />
          <span className="rainbow-band rainbow-green" />
          <span className="rainbow-band rainbow-blue" />
          <span className="rainbow-band rainbow-violet" />
        </span>
      </div>
      <div className="flying-creatures" aria-hidden="true">
        {FLYING_CREATURES.map((creature) => (
          <span key={creature.className} className={`flying-creature ${creature.className}`}>
            {creature.icon}
          </span>
        ))}
      </div>
      {bedazzleBurst.length > 0 ? (
        <div className="bedazzle-burst" aria-hidden="true">
          {bedazzleBurst.map((item) => (
            <span
              key={item.id}
              className={`bedazzle-burst-item burst-${item.kind}`}
              style={
                {
                  "--burst-left": `${item.left}px`,
                  "--burst-top": `${item.top}px`,
                  "--burst-to-x": `${item.toX}px`,
                  "--burst-to-y": `${item.toY}px`,
                  "--burst-size": `${item.size}px`,
                  "--burst-duration": `${item.duration}ms`,
                  "--burst-delay": `${item.delay}ms`,
                  "--burst-rotate-start": `${item.rotationStart}deg`,
                  "--burst-rotate-end": `${item.rotationEnd}deg`,
                  "--burst-scale": item.scale,
                  "--burst-opacity": item.opacity
                } as CSSProperties
              }
            >
              {item.symbol}
            </span>
          ))}
        </div>
      ) : null}

      <button
        className="star-button floating-star"
        type="button"
        onClick={triggerStarMoment}
        aria-label="Create a new appreciation spotlight"
      >
        <span>Shine</span>
      </button>

      <main className="page">
        <header className="hero">
          <div className="hero-copy">
            <p className="eyebrow">MAS: Mutual Admiration Society</p>
            <div className="flair-chip-row" aria-label="MAS flair">
              {FLAIR_CHIPS.map((chip) => (
                <span key={chip} className="flair-chip">
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="hero-actions">
            {authStatus?.member ? (
              <div className="linkedin-card">
                {authStatus.member.picture ? (
                  <img
                    className="linkedin-avatar"
                    src={authStatus.member.picture}
                    alt={authStatus.member.name}
                  />
                ) : (
                  <div className="linkedin-avatar linkedin-avatar-fallback" aria-hidden="true">
                    {authStatus.member.givenName.charAt(0)}
                  </div>
                )}
                <div className="linkedin-copy">
                  <p className="linkedin-kicker">Gleamsquad Connected</p>
                  <p className="linkedin-name">{authStatus.member.name}</p>
                  {authStatus.member.email ? (
                    <p className="linkedin-email">{authStatus.member.email}</p>
                  ) : null}
                </div>
              </div>
            ) : authStatus?.authEnabled ? (
              <button className="linkedin-button" type="button" onClick={connectLinkedIn}>
                Sparkify LinkedIn
              </button>
            ) : null}

            {authStatus?.member ? (
              <button
                className="ghost-button"
                type="button"
                onClick={() => void signOutLinkedIn()}
                disabled={isSigningOut}
              >
                {isSigningOut ? "Blinging out..." : "Bling-out"}
              </button>
            ) : null}

            <button
              className="refresh-button"
              type="button"
              onClick={() => void handleBedazzleRefresh()}
              disabled={isRefreshing}
            >
              {isRefreshing ? "Shimmering..." : "Bedazzle today’s notes"}
            </button>
          </div>
        </header>

        <section className="envelope-panel" aria-live="polite">
          <div key={pulseKey} className="envelope-card">
            <div className="envelope-flap" />
            <div className="envelope-letter">
              <p className="letter-label">Sparkledream Spotlight</p>
              {spotlightPerson ? (
                <>
                  <h2>{spotlightPerson.note.headline}</h2>
                  <p>{spotlightPerson.note.body}</p>
                  <div className="badge-row">
                    {spotlightPerson.note.badges.map((badge) => (
                      <span key={badge} className="badge">
                        {badge}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p>Twinkling up the Pearlpop confetti cannon...</p>
              )}
            </div>
          </div>
        </section>

        <section className="meta-strip">
          <p>{dashboard?.summary ?? "Gathering today’s Glitterati notes."}</p>
          <p>
            {dashboard ? `Last refreshed ${formatTimestamp(dashboard.generatedAt)}` : "Preparing the next glow-up in Pinktopia."}
          </p>
        </section>

        {error ? <section className="error-banner">{error}</section> : null}

        <section className="card-grid">
          {dashboard?.people.map((person) => (
            <article key={person.id} className="person-card">
              <div className="card-topline">
                <p className="person-name">{person.name}</p>
                {person.note.snapshot.status !== "unavailable" ? (
                  <span className={`snapshot-badge status-${person.note.snapshot.status}`}>
                    {person.note.snapshot.status}
                  </span>
                ) : null}
              </div>

              <h2>{person.note.headline}</h2>
              <p className="note-body">{person.note.body}</p>

              <div className="badge-row">
                {person.note.badges.map((badge) => (
                  <span key={badge} className="badge">
                    {badge}
                  </span>
                ))}
              </div>

              <div className="snapshot-panel">
                <p className="snapshot-title">{person.note.snapshot.title}</p>
                <p className="snapshot-snippet">{person.note.snapshot.snippet}</p>
              </div>
            </article>
          ))}
        </section>

        {authStatus && !authStatus.authEnabled ? (
          <p className="linkedin-note linkedin-note-footer">
            Lowkey glowing? Add LinkedIn OAuth environment variables to enable authenticated profile data.
          </p>
        ) : null}
      </main>
    </div>
  );
}

export default App;
