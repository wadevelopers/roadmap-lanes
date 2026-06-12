# Vision — Roadmap Lanes (RL), an Obsidian plugin

> 🇬🇧 English · [🇪🇸 Español](VISION.es.md)

> Product: **Roadmap Lanes** (short: **RL**). An **Obsidian plugin** that shows a roadmap folder as a **board of parallel work-lanes**, with the estimated time as each card's **height** and the **overlap** between tasks highlighted.
>
> It comes from a standalone web app (repo `roadmap-lanes`, frozen at `v0.2.0`) that proved the model and the rendering. This version rewrites it as a plugin to read from Obsidian's native index and leverage its ecosystem.

---

## 1. The problem

- **State lives in the file's *location*, not in a *field*.** When a task is finished you have to **move** its folder from `pending` to `done`, **rename** it and **fix the paths** that mentioned it. Slow, fragile, repetitive.
- **Parallelism is invisible.** There's no visual way to know which line of work finishes before another, or how much two tasks **collide** if run at the same time (worktrees + parallel AI agents).
- **What the market lacks.** "Tasks in markdown" is already crowded (Obsidian + Dataview, Logseq, Foam…). What almost nobody offers is the **orchestration of parallelism**: several lanes, overlap calculation, and a vertical Gantt per lane. That's RL's angle.

## 2. The idea, in one sentence

> Each task is a `.md` file with some data on top (*frontmatter*). RL reads the *vault* and draws it as a board of **lanes**, using the **estimated time as the height** of each card and showing the **overlap** between tasks of different lanes. State is a **field**, not the file's **location**.

## 3. Why an Obsidian plugin (and not the web)

The standalone web worked, but had two limits the plugin removes and one benefit only the plugin unlocks:

1. **No build, no `data.js`.** The web precompiled a giant `data.js`; editing a `.md` forced `npm run build` + reload. The plugin reads Obsidian's **`metadataCache`** — an index of the *frontmatter* of the whole vault that maintains **itself** and updates on save. Edit → done.
2. **Native markdown rendering.** Each task's body is shown with Obsidian's `MarkdownRenderer`: tables, lists, callouts, `[[wikilinks]]`, everything — not the web's limited homemade rendering.
3. **The ecosystem, for free.** Since the data is standard *frontmatter* with **wikilinks**, the **same data** is available to the native graph, backlinks and **Bases** (and plugins like **Extended Graph**), with no extra work (§8).

## 4. Design principles (the non-negotiables)

1. **Markdown-first.** The truth is `.md` files with *frontmatter*. No database, no cloud.
2. **Single source.** Each piece of data lives in **one place**. State is a field (`status: done`), not the location. Nothing is duplicated to "sync".
3. **One task = one file.** Each DT, FT, stage or epic is its own `.md`.
4. **The vault *is* the database.** RL uses a configurable roadmap folder inside the *vault*; `roadmap/` by default.
5. **Two views over the same source.** The RL board and Obsidian's native views (graph, Bases) look at the **same** `.md` files.
6. **The system assists, it doesn't impose.** Neither the order nor the overlap is decided automatically: RL **shows and alerts**; the decisions are the user's.
7. **Rough foresight, not exact estimation.** Time serves to **coordinate lanes** and **minimize overlap/blocks**, not for hour *tracking* (§7.9).

## 5. Architecture

```
  Obsidian vault                            Roadmap Lanes plugin
  ┌───────────────────────────┐             ┌─────────────────────────────────────┐
  │ roadmap/**/*.md           │  native     │ reads app.metadataCache             │
  │ roadmap/lanes.yaml        │ ──index──►  │   + lanes.yaml / taxonomy.yaml      │
  │ roadmap/taxonomy.yaml     │             │       (vault.adapter.read)          │
  └───────────────────────────┘             │            │                        │
            ▲                               │            ▼                        │
            │ edit a .md                    │   core: deriving states,            │
            │ (Obsidian reindexes itself)   │   overlap, gates  (ported from      │
            └─────── event ◄────────────────┤   the roadmap-lanes repo, v0.2.0)   │
                                            │            │                        │
                                            │            ▼                        │
                                            │   render in an ItemView (board)     │
                                            │   + MarkdownRenderer (detail panel) │
                                            └─────────────────────────────────────┘
```

- **Data source:** the tasks' *frontmatter* comes from `app.metadataCache` (no parsing files by hand). `lanes.yaml` and `taxonomy.yaml` are not notes: they're read with `vault.adapter.read` and cached.
- **Reactivity:** the plugin subscribes to `metadataCache.on("changed", …)` and `vault.on("modify", …)`; when a `.md` or `.yaml` changes, it re-renders. There's no build step.
- **Reused core:** the model logic (derived states, overlap calculation, gates) is ported as-is from the web `v0.2.0`; what's rewritten is **where the data comes from** and **where it's painted**.

## 6. What RL reads

1. The **tasks** — any `.md` inside the roadmap folder, with *frontmatter* (§7.2). The exception: a `.md` that declares `type: doc` is not a task but a **companion document** of one (§7.3).
2. The **lanes file** — `lanes.yaml`: which lane and in what order (§7.7).
3. The **taxonomy doc** — `taxonomy.yaml`: valid areas and zones (§7.6).

---

## 7. The data model

### 7.1 The axes (why there are so many fields and they don't mix)

A task has **independent dimensions**. The mistake to avoid is cramming several into one field. Each axis is its own field or relationship:

| Axis | Question | Where it lives |
|---|---|---|
| **Nature** | What kind of work is it? | `type` |
| **Hierarchy** | Is it part of something bigger? | `parent` (wikilink) |
| **Absorption** | Does it resolve other tasks when run? | `absorbs` (wikilinks) |
| **Maturity** | How ready is the *plan*? | `maturity` |
| **Status** | How far has the *work* gone? | `status` |
| **Classification** | What part of the system does it touch? | `areas`, `zones` |
| **Time** | How long does it take? | `duration` |
| **Dependencies** | What does it need first? | `depends_on` (wikilinks) |
| **Order and lane** | In which lane and position? | the **lanes file** |

### 7.2 The task record (frontmatter)

```yaml
---
id: FT-002
title: Payment gateway at checkout
type: feat                      # feat | maint | infra | combo | doc     (§7.3)
maturity: ready                 # raw | draft | ready  (§7.4)
status: pending                 # pending | done       (§7.4; the rest is derived)
duration: 40                    # hours, no suffix     (§7.9)
areas: [backend, payments]      # closed taxonomy      (§7.6)
zones: [CheckoutService, PaymentGateway]
parent: "[[EPIC-100]]"          # wikilink → hierarchy (§7.5, §8)
absorbs: []                     # wikilinks → tasks it resolves  (§7.5)
depends_on: ["[[FT-001]]"]      # wikilinks → dependencies  (§7.8, §8)
---

(the file body is the full plan in markdown)
```

**The relationships (`parent`, `depends_on`, `absorbs`) are quoted wikilinks.** It's the plugin's central format decision (§8): they serve equally for RL and for the native graph and backlinks. The identifiers are stable ids (`FT-002`); the rest of the fields are plain values.

### 7.3 `type` — closed list (5)

`combo` is a special structural value: a task that has children. It's not an executable card and doesn't take part in the board's type filter.

`doc` is the other structural value: a **part** — a companion document of a task whose plan spans several files (design, audit, appendices). A part declares `part_of: "[[TASK]]"` (single wikilink, mandatory) and optionally `title`; it is **not work**: it's excluded from the board (queues, backlog, overlap, gates, counts) but navigable from its task's detail panel. A part belongs to exactly **one** task that is not itself a part (no doc-of-doc chains — work hierarchy is `parent`/combo, not `part_of`), declares no task fields (`id`, `status`, `duration`, … are ignored with a warning) and its identity is its **path**, so two tasks can each have their own `DESIGN.md`. Suggested convention: one subfolder per multi-document task — folders still carry no semantics for the model.

For **leaf** tasks, evaluate top to bottom; the first "yes" wins:

1. Is it development plumbing or documentation the end user doesn't see (deps, build, scripts, config, migration, docs)? → `infra`
2. Does it add a **new capability**? → `feat`
3. Otherwise: fix/improve something that **already exists**, broken (bug) or suboptimal (debt) → `maint`

Leaves are **MECE**: each falls into exactly one of `feat`, `maint` or `infra`. **COMBOs** (tasks with children) declare `type: combo` so that Obsidian, Bases and the graph can identify them directly, but RL recognizes them by having children (`parent`), not by that field.

### 7.4 Maturity vs. status — two axes of the lifecycle

- **`maturity`** — how ready the *plan* is: `raw` (hot idea) → `draft` (documented, with open decisions, **not executable**) → `ready` (ready).
- **`status`** — how far the *work* has gone: `pending` → `done`. On leaves it's the real state; on COMBOs it's declared metadata for Obsidian and is validated against the children. There's no intermediate written state: *"in progress"* is derived.
- **Derived visual states (not written):**
  - `out-of-turn` = has an unfinished `depends_on`.
  - `next` = the first free task in the lane.
  - `waiting` = pending without a turn.
  - `in-progress` = **reserved for COMBOs**: some children done, not all.
  - `done` (COMBO) = all children done.

### 7.5 Hierarchy (`parent`) and absorption (`absorbs`)

- **`parent`** — structural relationship (a stage points to its big task; a task of an epic points to the epic). A **COMBO** (task with children) is a group: it declares `type: combo`, `status`, `maturity` and `duration` for Obsidian's tools, but RL derives order, blocks, gates, overlap, visual state and heights from the leaves. "Epic" is not a separate type: it's a task **that has children**.
- **`absorbs`** — an execution decision: a task consumes another separately recorded one (`FT-002 absorbs [[DT-005]]`). The absorbed one doesn't appear as a loose card: it's shown as a sub-item of the one absorbing it.

RL validates COMBOs without blocking the render: it alerts if `type: combo` is missing, if a leaf declares `combo`, if the declared `duration` is physically impossible, if `duration`/`maturity`/`status` is missing or if those fields deviate from what's derived. A duration greater than the sum of children can be legitimate (extra coordination) and can be accepted.

### 7.6 Areas and zones — closed taxonomy, not paths

- **`areas`** — **coarse** classification, a closed list defined in `taxonomy.yaml`. Filter and grouping.
- **`zones`** — second level (subdivision of the areas). **They are not file paths.** They are **what "clashes"**: the **overlap** between two tasks = intersection of their `zones`.
- **Closed but extensible:** a task only uses values that **already exist** in `taxonomy.yaml`; the doc is widened by editing it on purpose.
- `areas`/`zones` are left as **plain arrays** in the frontmatter (not wikilinks): Bases queries them anyway, and they add nothing to the dependency graph.

### 7.7 The lanes file — order and membership

Order and lane **don't live in the task**: they live in `lanes.yaml`, the single source of "which task, in which lane, in what order". Reordering = moving lines here.

```yaml
lanes:
  A: { focus: Checkout and payments,    worktree: main-app, queue: [FT-001, FT-002] }
  B: { focus: Independent improvements,  worktree: wt-side,  queue: [DT-011, INFRA-003, DT-020] }
# Every task NOT in any `queue` list = backlog. N lanes; the UI starts with 2.
```

**Order rule (the list rules; dependencies only alert):** RL **never reorders on its own**. If the list puts a task before something it depends on (unfinished), it marks it **"out of turn"** and explains why. *"The next pickable"* = the first in the queue that is **free**.

### 7.8 Derived relationships — gates and `unlocks` are not fields

- **Gates (cross-lane signals):** a `depends_on` between tasks of **different lanes**. RL draws it as a signal. It's not a separate field.
- **`unlocks`:** it's `depends_on` inverted. RL derives it from the graph. **Only one side is editable** (`depends_on`), so the two ends don't go out of sync.

### 7.9 Time — `duration` in hours

`duration` is declared as a **number of hours with no suffix**: `40`, `8`, `4`. The display converts those hours to days using the configured workday (`40` → `5d` with an 8 h workday), but the frontmatter stays numeric for Bases, extended graph and validations. Values with letters (`5d`, `4h`) are invalid-duration alerts.

On a leaf, `duration` feeds the card's height. On a COMBO, `duration` is the estimate of the whole stage and is shown the same in the bar and the detail; the block's height still comes from the leaves visible in each column. The goal is **rough foresight** (principle §4.7), not exact tracking.

---

## 8. Integration with Obsidian (what the format buys you)

Since the relationships are **wikilinks in frontmatter** (`parent: "[[EPIC-100]]"`, `depends_on: ["[[FT-001]]"]`) and the classification are **properties** (`type`, `status`, `maturity`, `areas`, `zones`), the **same data** RL uses feeds, with no extra work:

| Tool | What it gives |
|---|---|
| **Native graph** | Hierarchy (`parent`) and dependencies (`depends_on`) as a graph, colorable by `type`/`status`/`maturity`. |
| **Backlinks** | "What depends on this task?" appears on its own (it's `depends_on` inverted). |
| **Bases** (native) | Tables and queries over the frontmatter (`type`, `status`, `areas`…), with no extra data setup. |
| **Extended Graph** (plugin) | Colors/filters by **link type** (`parent`/`depends_on`/`absorbs`/`part_of`), shows several properties as arcs, saved views with a selector and **node size = `duration`**. |

> Verified (Jun 2026): since Obsidian 1.4, **quoted** wikilinks in frontmatter are parsed (`frontmatterLinks`), appear in the graph and backlinks and update on rename. That's why **fields aren't duplicated** and no sync script is needed: a single format serves everything. The plugin normalizes wikilink→id in **one single point** (when reading from the `metadataCache`, which already returns the resolved target).

This rewrites the web's old "deferred wikilinks" note: in the plugin, **adopting them is the right call**, not debt.

The practical configuration of the graph (native and with Extended Graph) and of Bases is in [`VISUALIZATION.md`](guides/VISUALIZATION.md).

## 9. The views

**a) Lanes board (the main one, RL's `ItemView`).**
- **Left:** backlog (every task outside the queues).
- **Middle:** one lane per column, with its queue ordered top to bottom.
- **Right:** done.
- Card height = time; colors = state; overlap and iconography as in `v0.2.0`. What each color, icon and signal means: [`guides/BOARD_LEGEND.md`](guides/BOARD_LEGEND.md).

**b) Detail panel** — on clicking a card: data, relationships, overlap and the **`.md` body rendered with** the native `MarkdownRenderer`.

**c) Ecosystem views** (§8) — graph (native + Extended Graph) and Bases: Obsidian provides them over the same data.

## 10. Scope and non-goals

- **Reading + minimal editing.** The plugin's MVP renders; editing fields from the board may come later (in the plugin it's feasible via `vault.modify`, unlike the web).
- It is **not** hour tracking or a classic project-management Gantt: it's coordination of **parallelism** between lanes.
- It does **not** reimplement what Obsidian already gives (graph, queries): it **leverages** it.
