# Workflow with Roadmap Lanes

> 🇬🇧 English · [🇪🇸 Español](../guides.es/FLUJO_DE_TRABAJO.md)

> How to discover, document and run a project's work with RL, **without a hand-maintained master
> index**. Assumes the data model from [`VISION.md`](../VISION.md) (types, maturity, status,
> lanes, overlap, gates). To read the board's **colors and symbols**, see
> [`BOARD_LEGEND.md`](BOARD_LEGEND.md).

## The anti-pattern RL replaces

The natural reflex is to keep a **manual master index**: a single document listing all the work, its
execution order, prerequisites, cross-lane signals, absorptions, status (✅/⏳) and the priority
rationale.

That index **is the symptom of the problem**, not the solution. It concentrates by hand everything RL
**derives**, and so:

- **It drifts out of sync:** every new, closed or reordered task forces an edit.
- **It hides overlap and priority:** they live as prose, not *computed* values. Knowing "what to pick
  up next" or "how much two lines of work collide" requires reconstructing it mentally.
- **It duplicates:** the raw idea lives in the index *and* the formal plan lives in another document,
  linked — two places for the same thing.

With RL there is no master index: there is **one file per unit of work** + a **lanes file**, and the
"index" is built by the board (live) and, if you want a table, Dataview.

## Setting up Obsidian for RL

In this version, RL assumes one simple rule:

**1 Obsidian vault = 1 Roadmap Lanes project.**

The project name comes from the **vault name**. For example, if the vault is called `demo-app`, the
board shows `Project demo-app`. There is no project selector and no support for multiple roadmaps in
the same vault.

RL creates and uses a roadmap folder inside the vault. By default it's called `roadmap`, and can be
changed in the plugin's native settings:

`Settings → Community plugins → Roadmap Lanes → Roadmap folder`

The expected default structure is:

```text
demo-app/
└── roadmap/
    ├── lanes.yaml
    ├── taxonomy.yaml
    ├── DT-001.md
    ├── FT-001.md
    └── notes/
        └── INFRA-001.md
```

RL reads:

- every `.md` inside `roadmap/`, including subfolders, as units of work;
- `roadmap/lanes.yaml` to order tasks into lanes;
- `roadmap/taxonomy.yaml` to validate areas and zones.

The plugin automatically creates the `roadmap/` folder and the `lanes.yaml` / `taxonomy.yaml` files if
they don't exist. It does not create a `tasks/` folder: if you want to organize tasks into subfolders,
you can do so inside `roadmap/`.

To work on another project, create or open another Obsidian vault. Running several projects inside the
same vault is not part of the supported flow for now.

The `roadmap/` folder should be reserved for RL documents. Any `.md` inside it is interpreted as a unit
of work.

## One unit of work = one file that matures

Each task (DT, FT, INFRA, epic…) is **its own `.md`**, and **the same file evolves** over its life — it
isn't moved, renamed or copied into another document:

- **`maturity`** (how ready the *plan* is): `raw` → `draft` → `ready`. *(VISION §7.4)*
- **`status`** (how far the *work* has gone): `pending` → `done`. On leaves it's the real state; on
  COMBOs it's validated against their children. *(VISION §7.4)*

The raw idea and the formal plan are **the same document** at different maturity. This is the core
improvement over the manual index: **single source**, no "moving the note into the plan".

## The flow, step by step

### 1. Discovery → a minimal `.md`

When you spot a problem while doing something else, you create a new file with minimal *frontmatter*
and a paragraph. Example:

```yaml
---
id: DT-042
title: Stock isn't restored when an item is returned
type: maint
maturity: raw            # hot idea, not investigated yet
status: pending
duration: 8               # hours, no suffix
zones: [CheckoutService] # even if rough: it feeds the overlap calculation
---

Spotted while touching checkout: returning an item doesn't add the quantity back to stock.
Need to check whether it also affects credit notes.
```

> Setting `zones` from the start (even tentatively) is what lets RL already show this task's overlap
> with the rest. The other fields can be filled in as it matures.

### 2. It shows up on its own in the backlog

You don't touch any index: RL scans the folder. The new task enters the **backlog** (it's in no lane
queue) and, because it has `zones`, **already takes part in the overlap calculation**.

### 3. Triage

- **Trivial / solved on the spot** → fix it, `status: done`, commit. *(What's solved instantly needs
  no file — see below.)*
- **Solved inside another in-progress task** → mark `absorbs` from that other task; the absorbed one
  doesn't appear as a loose card. *(VISION §7.5)*
- **Needs a plan** → **mature the same document** (step 4).

### 4. Maturing (the same document)

`maturity: raw → draft → ready`. The **body of the `.md` is the plan that grows**: in `draft` it's
documented with open decisions (not executable yet); in `ready` it's ready to pick up. No separate
document is created.

If the document grows and other tasks start pointing to it with `parent`, it stops being a leaf and
becomes a **COMBO**. At that point you manually change its frontmatter:

```yaml
type: combo
duration: 40       # stage estimate in hours
maturity: draft    # the lowest maturity of its leaves
status: pending    # done only when all children are done
```

RL keeps deriving blocks, overlap, gates and visual state from the leaves, but validates that the
COMBO's declared fields stay in sync. The COMBO's duration can be greater than the sum of its children
if it documents coordination or extra work of its own.

### 5. Execution (assign to a lane)

When you decide to execute it, you add it to a lane's queue in `roadmap/lanes.yaml`, at the chosen
position. Only then does RL show, for that task: the **overlap** with what's in other lanes, the
**gates** (if it depends on something in another lane), whether it's **out of turn**, and which is the
**next pickable** task. *(VISION §7.7, §7.8)*

## When NOT to create a file

Not every discovery deserves a `.md`. If it's fixed on the spot (small change, no design decision), fix
it and commit — it doesn't enter the board. The file is for what **stays pending**, must be
**prioritized** against other tasks, or must be **matured**.

## What each piece of the manual index becomes

| Master index (by hand) | Roadmap Lanes (derived / visual) |
|---|---|
| "In execution order" work list | `roadmap/lanes.yaml` + the board |
| "Prerequisites" column | `depends_on` |
| Cross-lane signals (A→B between lanes) | gates (derived from `depends_on` between lanes) |
| "Absorbs X, Y…" | `absorbs` |
| `✅`/`⏳` status per block | `status` (+ derived states) |
| "Lane A / Lane B" described in prose | the board columns |
| "Why this order" / prioritization | you **see** it on the board; it isn't written |

## What RL does NOT replace

- **The strategic "why" of the order** (e.g. "this task goes before that one because the second needs a
  decision the first one makes"). The board shows the **what** and the **order**; that reasoning, if you
  want to keep it, goes in the task **body** or a strategy document. RL orchestrates, it doesn't
  narrate.
- **The history of what's completed** (what was closed, in which version). That's history → it lives in
  `CHANGELOG.md` and `git`. RL shows the **current state** (`done`/`pending`), not the release timeline.

## In one sentence

You go from **maintaining and re-reading** an index where priority and overlap are prose you have to
reconstruct mentally, to **writing one task per unit of work** and **seeing** the order, the overlap and
"what to pick up next" **computed** on the board.
