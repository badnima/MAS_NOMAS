# MAS: Mutual Admiration Society

MAS is a playful full-stack web app that creates one fresh note of appreciation for each configured person. It is designed for deployment on Render and keeps the people list in JSON so the roster can grow without code changes.

## What it does

- Reads people from [data/people.json](/Users/nimabadiey/Documents/MAS_NOMAS/data/people.json)
- Tries a best-effort daily check of each person's public LinkedIn presence
- Generates one colorful appreciation note per person
- Stores the latest dashboard payload in JSON so the site loads fast
- Includes a star-shaped spotlight button that rotates through a surprise appreciation envelope

## Important note about LinkedIn

LinkedIn commonly restricts direct post scraping behind login and bot protections. This app therefore uses a graceful best-effort approach:

- First it tries the public `recent-activity` page
- Then it falls back to the public profile page metadata
- If both are unavailable, it still generates a heartfelt note from the configured admiration themes

That keeps MAS honest in production while leaving a clear place to swap in an approved LinkedIn data provider later.

## Local development

```bash
npm install
npm run dev
```

This starts:

- Vite on `http://localhost:5173`
- Express on `http://localhost:3001`

## Manual refresh

```bash
npm run refresh
```

## Render deployment

The repo includes [render.yaml](/Users/nimabadiey/Documents/MAS_NOMAS/render.yaml) with:

- A Node web service
- A persistent disk at `/var/data` for the generated appreciation cache
- A daily cron job scheduled for `16:00 UTC`

Render documents that cron jobs run on UTC schedules and that persistent disks attach to compatible services, which is why the cron job triggers the web service refresh endpoint instead of writing directly to disk. Sources:

- [Render Cron Jobs docs](https://render.com/docs/cronjobs)
- [Render Blueprint spec](https://render.com/docs/blueprint-spec)
- [Render Web Services docs](https://render.com/docs/web-services/)

## Configuring more people

Add entries to [data/people.json](/Users/nimabadiey/Documents/MAS_NOMAS/data/people.json) with this shape:

```json
{
  "id": "friendly-slug",
  "name": "Person Name",
  "linkedinUrl": "https://www.linkedin.com/in/example/",
  "admirationAngles": [
    "brings people together",
    "adds calm clarity",
    "follows through with care"
  ],
  "signatureThemes": ["kindness", "support", "reliability"],
  "sparkleTags": ["bright energy", "steady care", "team joy"]
}
```
