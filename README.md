# 🎨 Dev Portfolios

> **A searchable, filterable showcase of 1,500+ developer portfolio websites.**

[![Live Site](https://img.shields.io/badge/Live_Site-dev--portfolios.pages.dev-violet?style=for-the-badge)](https://dev-portfolios.pages.dev)
[![Auto-Updated](https://img.shields.io/badge/data-auto--updated-success?style=for-the-badge)](https://github.com/morrisonak/dev-portfolios/actions)
[![Portfolios](https://img.shields.io/badge/portfolios-1500+-blue?style=for-the-badge)](#)

Browse, search, and filter developer portfolios by **tech stack**, **experience level**, and more. Data is sourced from [emmabostian/developer-portfolios](https://github.com/emmabostian/developer-portfolios) and automatically kept in sync.

## ✨ Features

- **🔍 Instant Search** — Filter by name or title in real-time
- **🏷️ Stack Filters** — Filter portfolios by technology (React, Python, TypeScript, etc.)
- **📄 25 SEO Stack Pages** — Individual pages for each major technology
- **🎲 Random Portfolio** — Discover new sites with one click
- **📇 Rich Cards** — Tech stack pills, social links, location, experience badges
- **🤖 Auto-Updated** — Delta scraper syncs new portfolios every 6 hours via GitHub Actions
- **⚡ Static & Fast** — Built with Astro, deployed on Cloudflare Pages

## 📊 Scraped Data

Each portfolio is enriched with data extracted from the live site:

| Field | Coverage |
|-------|----------|
| Tech Stack | ~960 portfolios |
| GitHub | ~755 portfolios |
| LinkedIn | ~670 portfolios |
| Email | ~510 portfolios |
| Twitter/X | ~360 portfolios |
| Location | varies |
| Experience | varies |

Raw data available at [`data/portfolios.json`](./data/portfolios.json).

## 🏗️ Tech Stack

- **[Astro](https://astro.build)** — Static site generator
- **[Tailwind CSS v4](https://tailwindcss.com)** — Styling
- **[Cloudflare Pages](https://pages.cloudflare.com)** — Hosting
- **[GitHub Actions](https://github.com/features/actions)** — CI/CD + automated data sync

## 🔄 How Auto-Update Works

1. GitHub Actions cron runs every 6 hours
2. `scrape-delta.mjs` diffs upstream README against our `portfolios.json`
3. Only **new** sites are scraped, **removed** sites are pruned
4. Updated JSON is committed back to the repo
5. Astro rebuilds and deploys to Cloudflare Pages

No full re-scrapes. Surgical delta updates only.

## 🚀 Development

```bash
npm install
npm run build        # Build static site
npm run preview      # Preview locally
```

### Scripts

| Script | Description |
|--------|-------------|
| `node scripts/scrape-delta.mjs` | Scrape only new/removed portfolios |
| `node scripts/scrape2.mjs` | Full scrape of all portfolios |

## 📝 License

MIT

## 🙏 Credits

Portfolio data sourced from [emmabostian/developer-portfolios](https://github.com/emmabostian/developer-portfolios) — an amazing community-maintained list by [Emma Bostian](https://github.com/emmabostian).
