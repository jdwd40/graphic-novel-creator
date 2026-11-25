# Graphic Novel Creator

An interactive gamebook and graphic novel builder and reader featuring the **Beats and Tells** combat system.

## Prerequisites

- Node.js 20+ (CI runs on Node 22)
- npm

## Setup

```bash
npm install
```

## Available Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and build production assets into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | Run TypeScript compiler checks (`tsc --noEmit`) |
| `npm run lint` | Run ESLint across the repository |
| `npm test` | Run the Vitest test suite once |
| `npm run test:watch` | Run Vitest in watch mode |

## Architecture

- `src/combat/` — Pure, deterministic Beats and Tells combat engine (no React, `@xyflow/react`, or storage imports).
- `src/story/` — Story data model, validation, seeded graphic novel, and `localStorage` persistence.
- `src/builder/` — `@xyflow/react` v12 story map editor, encounter inspector, and live balance preview.
- `src/player/` — Mobile-first comic reader, combat screen, and end-of-fight comic strip.

## Documentation

- [Combat System Spec](docs/combat-system-spec.md)
- [Combat System Implementation Plan](docs/combat-system-plan.md)
