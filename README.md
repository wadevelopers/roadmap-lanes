# Roadmap Lanes

> 🇬🇧 English · [🇪🇸 Español](README.es.md)

A roadmap board for Obsidian. Each task is a markdown note; the board draws them as **parallel
work-lanes**, using each task's **estimated time as its height** (a vertical Gantt) and showing where
lanes **overlap**. State is a *field*, not a folder. No build, no database — it reads your notes'
frontmatter through Obsidian's native index, so the board updates as you edit.

![Roadmap Lanes board](docs/assets/screenshot.png)

## What it does

- A task = one `.md` note with a small frontmatter (`type`, `maturity`, `status`, `duration`, `zones`,
  `depends_on`, …).
- The board **derives** everything: lane order, time-as-height, **lane overlap** (tasks of different
  lanes touching the same zone), **cross-lane gates** (dependencies between lanes) and **model alerts**
  (data inconsistencies).
- Nothing to keep in sync by hand: add or edit a note and the board reflects it.

## Install

In Obsidian: **Settings → Community plugins → Browse → "Roadmap Lanes" → Install → Enable**.

Manual: copy `main.js`, `manifest.json` and `styles.css` into
`<vault>/.obsidian/plugins/roadmap-lanes/`.

## Quick start

1. The plugin creates a `roadmap/` folder in your vault (with `lanes.yaml` and `taxonomy.yaml`).
2. Add a task note inside `roadmap/`:
   ```yaml
   ---
   id: FT-001
   title: Checkout page
   type: feat
   maturity: ready
   status: pending
   duration: 8        # hours
   zones: [checkout]
   ---
   ```
3. Open the board: command **"Open roadmap lanes board"** or the ribbon icon.
4. To put tasks in a lane, list their `id` in `roadmap/lanes.yaml`.

Full process in the [workflow guide](docs/guides/WORKFLOW.md).

## Features

- **Time-as-height (Gantt) ↔ order mode** — a switch: height = duration, or all cards equal to read just
  the order.
- **Lane overlap** and **cross-lane gates**, colored by severity.
- **Model alerts** (broken refs, duplicate ids, invalid values…), dismissable.
- **CLI validator** for agents and hooks: run the same model alerts outside Obsidian.
- **Detail panel**, **filters** (text / type / maturity / columns) and **collapsible** coordination
  sections.
- Works alongside the native **graph** and **Bases** over the same frontmatter.

## Settings

| Setting | What it does |
|---|---|
| **Roadmap folder** | Folder where RL keeps `lanes.yaml`, `taxonomy.yaml` and task notes. |
| **Workday duration** | Hours per day; converts `duration` (hours) to days for display and card height. |
| **Compact type labels** | Show a task's type as a small color dot instead of a labeled chip — saves width in narrow columns. |
| **Highlight waiting tasks** | Dim every task's left border except those waiting on another, shown in the accent color. |

## Guides

- [Workflow](docs/guides/WORKFLOW.md) — how to discover, document and run work with RL.
- [Agent workflow](docs/guides/AGENT_WORKFLOW.md) — the contract for an AI agent driving the board.
- [Board legend](docs/guides/BOARD_LEGEND.md) — what every color, icon and signal means.
- [Visualization](docs/guides/VISUALIZATION.md) — the native graph and Bases over the same data.

## Design

The data model and the reasoning behind it live in [`docs/VISION.es.md`](docs/VISION.es.md) — for the curious
and for contributors.

## Development

```sh
npm install
npm run dev     # build main.ts -> main.js and validate.ts -> validate.js in watch mode
npm run build   # production build
```

Symlink the repo into `<vault>/.obsidian/plugins/roadmap-lanes/` to test live in a vault.

After `npm run build`, validate a roadmap folder from the command line:

```sh
node validate.js <vault>/roadmap --report --strict
```

Use `--json` for tooling output and `--lang es` for Spanish messages.
