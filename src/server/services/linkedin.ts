import * as cheerio from "cheerio";

import type { LinkedInSnapshot, PersonConfig, SnapshotStatus } from "../../shared/types.js";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function cleanText(value: string | undefined | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function isGenericProfileSnippet(snippet: string) {
  return /connections on linkedin|view .*profile on linkedin|professional community of 1 billion members/i.test(
    snippet
  );
}

function summarizeHtml(html: string) {
  const $ = cheerio.load(html);
  const title =
    cleanText($("meta[property='og:title']").attr("content")) ||
    cleanText($("title").text()) ||
    "LinkedIn profile snapshot";

  const snippet =
    cleanText($("meta[name='description']").attr("content")) ||
    cleanText($("meta[property='og:description']").attr("content")) ||
    cleanText($("main").text()).slice(0, 240);

  return { title, snippet };
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

function buildFallback(person: PersonConfig, sourceUrl: string, status: SnapshotStatus): LinkedInSnapshot {
  const angle = person.admirationAngles[0] ?? "shows up generously";

  return {
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    status,
    title: `${person.name} appreciation snapshot`,
    snippet: `${person.name} consistently ${angle}.`
  };
}

export async function fetchLinkedInSnapshot(person: PersonConfig): Promise<LinkedInSnapshot> {
  const candidates = [
    `${person.linkedinUrl.replace(/\/$/, "")}/recent-activity/all/`,
    person.linkedinUrl
  ];

  for (const candidate of candidates) {
    try {
      const html = await fetchHtml(candidate);
      const summary = summarizeHtml(html);

      if (!summary.snippet || /sign in|join now|login/i.test(summary.snippet)) {
        continue;
      }

      const isActivityPage = candidate.includes("/recent-activity/");
      const status: SnapshotStatus =
        isActivityPage && !isGenericProfileSnippet(summary.snippet) ? "fresh" : "fallback";

      return {
        sourceUrl: candidate,
        fetchedAt: new Date().toISOString(),
        status,
        title: summary.title,
        snippet: summary.snippet
      };
    } catch {
      continue;
    }
  }

  return buildFallback(person, person.linkedinUrl, "unavailable");
}
