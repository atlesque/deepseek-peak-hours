# Deepseek Peak Hours

> Tells you when it's peak hours for using the DeepSeek API — at a glance.

A single-page web app that checks whether it's currently peak usage hours for the DeepSeek API (UTC, Monday through Friday) and displays the result with a live countdown timer and an animated gradient background.

Peak-rate hours are **01:00–04:00** and **06:00–10:00 UTC, Monday through Friday**. All other hours are off-peak, and off-peak rates are **half of peak rates**.

## ✨ Features

- **Live peak / off-peak indicator** — instantly see if it's peak time
- **Countdown timer** — shows how long until the next window starts or ends
- **Animated gradient canvas** — red-themed orbs during peak, blue during off-peak
- **Timezone-aware** — displays UTC time, your local time, and peak windows converted to your timezone
- **Info panel** — toggle for detailed time breakdowns
- **Zero dependencies** beyond Astro — pure TypeScript + Canvas API

## 🛠 Tech Stack

| Layer           | Technology                           |
| --------------- | ------------------------------------ |
| Framework       | [Astro](https://astro.build) v7      |
| Language        | TypeScript                           |
| Styling         | Vanilla CSS                          |
| Animation       | Canvas 2D API (custom mesh gradient) |
| Package manager | pnpm                                 |

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) **v18** or later
- [pnpm](https://pnpm.io) **v8** or later

### Install

```bash
git clone https://github.com/atlesque/deepseek-peak-hours.git
cd deepseek-peak-hours
pnpm install
```

### Development

Start the dev server (defaults to port **8470**):

```bash
pnpm dev
```

Open [http://localhost:8470](http://localhost:8470) in your browser. The page hot-reloads on file changes.

### Build

Generate a static production build:

```bash
pnpm build
```

Output is written to `dist/` — ready to deploy to any static host (Vercel, Netlify, Cloudflare Pages, etc.).

### Preview

Preview the production build locally:

```bash
pnpm preview
```

## 📂 Project Structure

```
deepseek-peak-hours/
├── public/                  # Static assets (favicon, etc.)
├── src/
│   ├── env.d.ts             # TypeScript environment declarations
│   ├── lib/
│   │   ├── canvas-gradient.ts  # Animated mesh gradient (Canvas 2D)
│   │   └── peak-hours.ts       # UTC pricing-window logic & peak detection
│   ├── pages/
│   │   └── index.astro         # Main page (Astro component + inline JS)
│   └── styles/
│       └── index.css           # All styles
├── astro.config.mjs         # Astro configuration (port, etc.)
├── tsconfig.json            # TypeScript config (extends Astro base)
├── eslint.config.mjs        # ESLint configuration
├── package.json             # Dependencies & scripts
└── pnpm-workspace.yaml      # pnpm workspace definition
```

## ⚙️ How It Works

1. **UTC time computation** — `peak-hours.ts` uses UTC date components to determine the current weekday and time, avoiding any server-side timezone pitfalls.

2. **Peak detection** — Compares the current UTC weekday and time against the two weekday peak windows. All other times use the off-peak rate multiplier of 0.5:
   - 01:00–04:00 UTC
   - 06:00–10:00 UTC

3. **Client-side rendering** — All logic runs in the browser. The status, countdown, and clocks update continuously via `requestAnimationFrame`.

4. **Visual feedback** — An animated canvas with floating "orbs" renders a red palette during peak hours and a blue palette during off-peak hours, providing an immediate visual cue.

## 📜 Available Scripts

| Script              | Description                      |
| ------------------- | -------------------------------- |
| `pnpm dev`          | Start Astro dev server           |
| `pnpm build`        | Build for production             |
| `pnpm preview`      | Preview production build locally |
| `pnpm lint`         | Run ESLint                       |
| `pnpm lint:fix`     | Run ESLint with auto-fix         |
| `pnpm format`       | Format code with Prettier        |
| `pnpm format:check` | Check formatting with Prettier   |

## 📄 License

MIT
