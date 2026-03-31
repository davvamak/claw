# Kilobot Researcher

Daily news digest for Liverpool-focused content — served via GitHub Pages.

## Live Dashboard

Once GitHub Pages is enabled, view your dashboard at:
**`https://davvamak.github.io/claw/researcher/dashboard/`**

## Setup GitHub Pages

1. Go to https://github.com/davvamak/claw/settings/pages
2. Under "Source", select "GitHub Actions"
3. The dashboard will deploy automatically on the next push

## What's Included

- **Liverpool FC** — transfers, match results, club news
- **Premier League** — table, fixtures, general EPL news
- **Liverpool City** — local news, Merseyside updates

## Automation

Runs daily at 8 AM (UK time) via cron job. Results are automatically:
- Saved to `researcher/data/`
- Committed and pushed to GitHub
- Deployed to the live dashboard

## Manual Run

To manually trigger a news gather:

```bash
cd researcher
node src/gather.js
```
