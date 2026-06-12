# Board legend (how to read Roadmap Lanes)

> 🇬🇧 English · [🇪🇸 Español](../guides.es/LEYENDA_DEL_TABLERO.md)

A reference for what every **color**, **icon** and **signal** on the board means. The board **derives**
everything from the notes' frontmatter (see [`WORKFLOW.md`](WORKFLOW.md) and
[`VISION.md`](../VISION.md)); here we explain how to **read it**.

---

## 1. The card

A card = a task. Top to bottom, its rows:

1. **Header**: `id` · **type** chip · **duration** (on the right).
2. **Title**.
3. **Meta**: **maturity** icon + **absorbs** / **overlap** icons.
4. **State** (bottom).

The card's **height** represents **time**: taller = more hours (Gantt mode).

### Type (color chip)

| Chip | Value (`type`) | Color | Meaning |
|---|---|---|---|
| `FEAT` | `feat` | blue | **Feature**: new capability. |
| `MAINT` | `maint` | orange | **Maintenance**: fix/improve what already exists (bug or debt). |
| `INFRA` | `infra` | purple | **Infra**: plumbing, build, docs — what the end user doesn't see. |
| `COMBO` | `combo` | accent | **Group**: a stage with child tasks. |

### Maturity (icon) — how ready the *plan* is

| Icon | Value (`maturity`) | Meaning |
|:---:|---|---|
| ![note](../assets/note.svg) | `raw` | Captured raw (idea, spotted problem, TODO), not analyzed. |
| ![skull](../assets/skull.svg) | `draft` | Documented with open decisions; **not executable yet**. |
| ![star](../assets/star-fat.svg) | `ready` | Ready to execute. |

### Other icons (meta row)

| Icon | Meaning |
|:---:|---|
| ![pacman](../assets/pacman.svg) | The task **absorbs** another: it resolves it within itself; the absorbed one doesn't appear as a loose card. |
| ![overlapping circles](../assets/photo-filter.svg) | The task **collides** (overlaps) with another from a different lane on a shared zone. The **id of that task** is colored by level (§3). |

### State — how far the *work* has gone

| State | Color | Meaning |
|---|---|---|
| **Done** | green | Finished. |
| **In progress** | blue | Started but not finished (a COMBO with some children done). |
| **Next** | yellow | The next pickable task in its lane. |
| **Waiting for…** | red | **Blocked**: waiting on an unfinished dependency. |
| **Waiting** | neutral | Pending, neither next nor blocked. |

---

## 2. Lanes, backlog and done

- Each **column** is a **lane** (defined in `lanes.yaml`), with its ordered work queue.
- **Backlog**: tasks with `zones`/data but **no lane** assigned (not yet decided to execute).
- **Done**: a separate column for finished work (a record, out of the active coordination).

---

## 3. Lane overlap

Two tasks from **different lanes** that touch the **same zone** *collide*: doing them at once risks a
clash (one overwrites the other's work). The level measures **how much** the two lanes' zones overlap.

| Level | Color | Meaning |
|---|---|---|
| 0 | green | No overlap or minimal. |
| 1 | yellow | Low overlap. |
| 2 | orange | Medium overlap. |
| 3 | red | High overlap: strong risk of clashing. |

> **Done** tasks don't count for overlap (they can no longer clash with anything).

---

## 4. Cross-lane gates

A **gate** `A → B` means task **A depends on B** (`depends_on`) and they are in **different lanes**. It
coordinates the order between lanes. The color reports the state **from A**:

| A (the dependent) | B (the dependency) | Color | What it means |
|---|---|---|---|
| pending | pending | 🟠 **orange** (waiting) | Respect the order: do **B before A**. |
| pending | done | 🟢 **green** (ready) | B finished → you can **start A** clean. |
| done | pending | 🔴 **red** (out of order) | You did **A without B** → you'll have to **rework A** once B finishes (it will overwrite it). |
| done | done | — (hidden) | Resolved: not shown. |

> Red is the actionable case: the problem is **not** being blocked (that's normal and expected), but
> having worked **out of order**. Dependencies **within the same lane** are not gates (the queue order
> already handles them).

---

## 5. Model alerts

Inconsistencies in the roadmap data, grouped by **severity**:

| Severity | Color | Meaning |
|---|---|---|
| **Error** | red | **Broken/impossible** data (dangling reference, duplicate id, invalid enum). Must be fixed. |
| **Warning** | orange | **Recoverable** inconsistency, may be intentional (unknown area/zone, out-of-sync COMBO). Can be **accepted** or fixed. |
| **Info** | blue | A soft reminder, not an error. |

A warning also appears when the **Next** task in a lane is not `maturity: ready` or does not declare
`maturity`: the task can stay in the lane, but its plan should be promoted before execution.

RL also reports source hygiene issues here: task notes without frontmatter, and relation fields like
`parent`, `depends_on` or `absorbs` declared as an explicit empty string.

Warnings/info come with an **Accept** button to silence that specific alert; it reappears if the values
change.

---

## 6. Quick color table

The same color means different things depending on **where** it appears:

| Color | Card state | Overlap | Gate | Alert |
|---|---|---|---|---|
| **Green** | done | level 0 | ready (B done, A pending) | — |
| **Yellow** | next | level 1 | — | — |
| **Orange** | — | level 2 | waiting (both pending) | warning |
| **Red** | blocked | level 3 | out of order (A done, B pending) | error |
| **Blue** | in progress | — | — | info |

---

## 7. Board controls and settings

- **Time ↔ order mode**: in *time*, card height = duration; in *order*, all cards are equal and only
  the position in the lane queue matters.
- **Filters**: by text, type, maturity and columns.
- **Collapse coordination**: each block (overlap / gates / alerts) has a `▲/▼` toggle; the per-color
  counter in the header stays visible when collapsed.
- **Compact type labels** (setting): the type chip becomes a color dot, to save width.
- **Highlight waiting tasks** (setting): dims every task's border except those *waiting for* another,
  which switch to the theme's accent color.
