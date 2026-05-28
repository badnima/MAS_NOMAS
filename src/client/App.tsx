import { useEffect, useState } from "react";

import type {
  AuthStatusPayload,
  DashboardPayload,
  PersonWithNote
} from "../shared/types";

const SPOTLIGHT_STORAGE_KEY = "mas-spotlight-index";
const SPOTLIGHT_ROTATION_INTERVAL_MS = 8000;
const SPARKLE_COUNT = 14;
const BUBBLE_COUNT = 7;
const FLYING_CREATURES = [
  { className: "unicorn-flight-one", icon: "🦄" },
  { className: "horse-flight", icon: "🐎" },
  { className: "unicorn-flight-two", icon: "🦄" }
] as const;

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

function App() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatusPayload | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);

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
      <div className="flying-creatures" aria-hidden="true">
        {FLYING_CREATURES.map((creature) => (
          <span key={creature.className} className={`flying-creature ${creature.className}`}>
            {creature.icon}
          </span>
        ))}
      </div>

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
                  <p className="linkedin-kicker">LinkedIn Connected</p>
                  <p className="linkedin-name">{authStatus.member.name}</p>
                  {authStatus.member.email ? (
                    <p className="linkedin-email">{authStatus.member.email}</p>
                  ) : null}
                </div>
              </div>
            ) : authStatus?.authEnabled ? (
              <button className="linkedin-button" type="button" onClick={connectLinkedIn}>
                Connect LinkedIn
              </button>
            ) : null}

            {authStatus?.member ? (
              <button
                className="ghost-button"
                type="button"
                onClick={() => void signOutLinkedIn()}
                disabled={isSigningOut}
              >
                {isSigningOut ? "Signing out..." : "Sign out"}
              </button>
            ) : null}

            <button
              className="refresh-button"
              type="button"
              onClick={() => void loadDashboard(true)}
              disabled={isRefreshing}
            >
              {isRefreshing ? "Refreshing joy..." : "Refresh today’s notes"}
            </button>
          </div>
        </header>

        <section className="envelope-panel" aria-live="polite">
          <div key={pulseKey} className="envelope-card">
            <div className="envelope-flap" />
            <div className="envelope-letter">
              <p className="letter-label">Spotlight Note</p>
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
                <p>Loading the confetti cannon...</p>
              )}
            </div>
          </div>
        </section>

        <section className="meta-strip">
          <p>{dashboard?.summary ?? "Gathering today’s appreciation notes."}</p>
          <p>
            {dashboard ? `Last refreshed ${formatTimestamp(dashboard.generatedAt)}` : "Preparing the first glow-up."}
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
            Add LinkedIn OAuth environment variables to enable authenticated profile data.
          </p>
        ) : null}
      </main>
    </div>
  );
}

export default App;
