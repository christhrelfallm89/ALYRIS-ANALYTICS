# ALYRIS Analytics

Static analytics dashboard for ALYRIS built with **HTML + Tailwind CDN + vanilla JavaScript + Chart.js**.

This version replaces the original EPK layout with:

- repository-backed daily JSON snapshots of the Google Sheet
- timeframe selectors: **7 / 30 / 90 / year to date / all time / custom**
- growth reporting for every tracked numeric metric in the format **+7 (+12%)**
- green growth / red decline indicators
- trend charts that update automatically for the selected timeframe

## Data source

The dashboard reads from the published Google Sheet already used in the original repository:

- `metrics.mjs` holds the shared sheet URL and metric definitions
- `scripts/fetch_analytics_history.py` fetches the CSV and stores normalized JSON into `data/`
- `app.js` reads the stored JSON so GitHub Pages can show historical reporting without needing a backend

## Tracked metrics

- Total Streams
- Total Followers
- Instagram Followers
- TikTok Followers
- YouTube Subscribers
- YouTube Views
- Spotify Followers
- Spotify Monthly Listeners
- Facebook Followers

## Daily automation

GitHub Actions is configured in `.github/workflows/daily-sync.yml` to:

1. run every day
2. fetch the latest sheet data
3. update `data/history.json` and `data/latest.json`
4. commit the change back to the repo automatically
5. post a daily growth report to Discord (if webhook secret is configured)

You can also trigger it manually with **Actions → Sync analytics history → Run workflow**.

### Discord daily report setup

1. In Discord, edit your channel → **Integrations** → **Webhooks** → **New Webhook**
2. Copy the webhook URL
3. In GitHub repo settings: **Settings → Secrets and variables → Actions**
4. Create a new repository secret named `DISCORD_WEBHOOK_URL`
5. Paste the webhook URL as the value

Once set, the daily workflow posts a growth summary using `scripts/post_discord_report.py`.

## Run locally

From the repository root:

```bash
python3 -m http.server 5173
```

Open:

- `http://localhost:5173`

## Manual snapshot refresh

To create or refresh the stored JSON locally:

```bash
python3 scripts/fetch_analytics_history.py
```

## GitHub Pages deployment

1. Push this folder to the new GitHub repo: **ALYRIS-ANALYTICS**
2. In GitHub → **Settings → Pages**
3. Choose **Deploy from a branch**
4. Select **main** and the root folder `/`

The default Pages URL will be:

- `https://christhrelfallm89.github.io/ALYRIS-ANALYTICS/`

If you want a custom domain for analytics, add a new `CNAME` later once you know the final hostname. The old EPK domain file has been removed on purpose so this repo does not inherit the source site's domain.

## Creating the GitHub repo

This local copy is ready to publish as `ALYRIS-ANALYTICS`. If you have not created the remote repo yet:

1. create a new empty GitHub repository named `ALYRIS-ANALYTICS`
2. point `origin` at the new repo
3. push the current branch

Example:

```bash
git remote set-url origin https://github.com/christhrelfallm89/ALYRIS-ANALYTICS.git
git push -u origin main
```

## Notes

- The original `alyris-epk` repository is not modified by this work.
- With only one stored snapshot, growth values will show as flat until additional daily snapshots accumulate.

