export type AppreciationTheme =
  | "kindness"
  | "leadership"
  | "dedication"
  | "humor"
  | "support"
  | "reliability"
  | "empathy";

export type AppreciationTone =
  | "warm"
  | "playful"
  | "formal"
  | "heartfelt"
  | "funny"
  | "brief";

export type SnapshotStatus = "fresh" | "fallback" | "unavailable";

export interface PersonConfig {
  id: string;
  name: string;
  linkedinUrl: string;
  admirationAngles: string[];
  signatureThemes: AppreciationTheme[];
  sparkleTags: string[];
}

export interface LinkedInSnapshot {
  sourceUrl: string;
  fetchedAt: string;
  status: SnapshotStatus;
  title: string;
  snippet: string;
}

export interface AppreciationNote {
  id: string;
  personId: string;
  generatedAt: string;
  headline: string;
  body: string;
  theme: AppreciationTheme;
  tone: AppreciationTone;
  badges: string[];
  snapshot: LinkedInSnapshot;
}

export interface PersonWithNote extends PersonConfig {
  note: AppreciationNote;
}

export interface DashboardPayload {
  people: PersonWithNote[];
  generatedAt: string;
  summary: string;
}
