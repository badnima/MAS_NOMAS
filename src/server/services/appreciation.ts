import {
  type AppreciationNote,
  type AppreciationTheme,
  type AppreciationTone,
  type DashboardPayload,
  type LinkedInSnapshot,
  type PersonConfig,
  type PersonWithNote
} from "../../shared/types.js";
import { fetchLinkedInSnapshot } from "./linkedin.js";

const TONES: AppreciationTone[] = [
  "warm",
  "playful",
  "formal",
  "heartfelt",
  "funny",
  "brief"
];

const THEME_PHRASES: Record<AppreciationTheme, string[]> = {
  kindness: [
    "brings kindness that changes the temperature of the room",
    "shows care in a way that feels immediate and real",
    "makes generosity look effortless"
  ],
  leadership: [
    "sets direction without losing the human touch",
    "helps people feel brave enough to do their best work",
    "turns vision into confident forward motion"
  ],
  dedication: [
    "keeps showing up with thoughtful effort",
    "puts real care behind every follow-through",
    "gives consistency a joyful kind of discipline"
  ],
  humor: [
    "adds levity exactly when the team needs it",
    "keeps things bright without losing substance",
    "makes work feel more alive and more connected"
  ],
  support: [
    "creates lift for everyone nearby",
    "shows up in ways that make collaboration easier",
    "reminds people they do not have to figure things out alone"
  ],
  reliability: [
    "is the kind of steady presence people can build around",
    "makes trust feel well-earned and easy",
    "turns consistency into comfort for the whole team"
  ],
  empathy: [
    "pairs clear thinking with genuine understanding",
    "notices what people need and responds with care",
    "makes compassion feel practical and strong"
  ]
};

const OPENERS = [
  "Today MAS is cheering for",
  "A bright note for",
  "Today’s admiration spotlight belongs to",
  "With balloons and gratitude, we celebrate"
];

const CLOSERS = [
  "That kind of energy deserves confetti.",
  "It is exactly the kind of presence a Mutual Admiration Society is made for.",
  "The room gets better when that spirit is in it.",
  "That is some very real unicorn-level encouragement."
];

function pickFrom<T>(values: T[], seed: number) {
  return values[seed % values.length];
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function sentenceCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildHeadline(person: PersonConfig, theme: AppreciationTheme) {
  return `${person.name}: ${sentenceCase(theme)} in Full Color`;
}

function buildBody(person: PersonConfig, snapshot: LinkedInSnapshot, theme: AppreciationTheme, tone: AppreciationTone) {
  const baseSeed = hashString(`${person.id}-${snapshot.fetchedAt}-${theme}-${tone}`);
  const opener = pickFrom(OPENERS, baseSeed);
  const angle = pickFrom(person.admirationAngles, baseSeed + 1);
  const themePhrase = pickFrom(THEME_PHRASES[theme], baseSeed + 2);
  const closer = pickFrom(CLOSERS, baseSeed + 3);
  const snippetLead =
    snapshot.status === "fresh"
      ? `A quick LinkedIn check surfaced this energy: "${snapshot.snippet}".`
      : snapshot.status === "fallback"
        ? `The latest public LinkedIn snapshot still points in a lovely direction: "${snapshot.snippet}".`
        : `LinkedIn was shy today, so MAS leaned on the qualities already worth celebrating.`;

  return `${opener} ${person.name}. ${snippetLead} ${person.name} ${angle} and ${themePhrase}. ${closer}`;
}

export async function buildDashboardFromPeople(people: PersonConfig[]): Promise<DashboardPayload> {
  const generatedAt = new Date().toISOString();
  const withNotes = await Promise.all(
    people.map(async (person, index): Promise<PersonWithNote> => {
      const snapshot = await fetchLinkedInSnapshot(person);
      const theme = pickFrom(person.signatureThemes, index + hashString(person.id));
      const tone = pickFrom(TONES, index + hashString(snapshot.title));
      const note: AppreciationNote = {
        id: `${person.id}-${generatedAt}`,
        personId: person.id,
        generatedAt,
        headline: buildHeadline(person, theme),
        body: buildBody(person, snapshot, theme, tone),
        theme,
        tone,
        badges: [...person.sparkleTags.slice(0, 2), theme],
        snapshot
      };

      return {
        ...person,
        note
      };
    })
  );

  return {
    generatedAt,
    people: withNotes,
    summary: "Fresh gratitude notes, balloons loaded, and encouragement ready to ship."
  };
}
