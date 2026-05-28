import { useEffect, useState } from "react";

import type { DashboardPayload, PersonWithNote } from "../shared/types";

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function App() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    void loadDashboard();
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
      setSpotlightIndex((currentIndex) =>
        payload.people.length === 0 ? 0 : currentIndex % payload.people.length
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Something bright went dim for a moment."
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  function triggerStarMoment() {
    if (!dashboard || dashboard.people.length === 0) {
      return;
    }

    setSpotlightIndex((currentIndex) => {
      const nextIndex = Math.floor(Math.random() * dashboard.people.length);

      if (dashboard.people.length === 1 || nextIndex !== currentIndex) {
        return nextIndex;
      }

      return (currentIndex + 1) % dashboard.people.length;
    });
    setPulseKey((value) => value + 1);
  }

  const spotlightPerson: PersonWithNote | null =
    dashboard && dashboard.people.length > 0 ? dashboard.people[spotlightIndex] : null;

  return (
    <div className="page-shell">
      <div className="floating-blob blob-pink" />
      <div className="floating-blob blob-yellow" />
      <div className="floating-blob blob-green" />
      <div className="balloon-cluster" aria-hidden="true">
        <span className="balloon balloon-pink" />
        <span className="balloon balloon-yellow" />
        <span className="balloon balloon-green" />
      </div>
      <div className="sparkle-row">
        <span />
        <span />
        <span />
        <span />
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
                <a href={person.linkedinUrl} target="_blank" rel="noreferrer">
                  Visit LinkedIn
                </a>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

export default App;
