# Agent workflow with Roadmap Lanes

> 🇬🇧 English · [🇪🇸 Español](../guides.es/FLUJO_DEL_AGENTE.md)

> The contract an **AI agent** reads at the start of a session to operate an RL roadmap. RL is
> built so an agent **writes the documents** and a human **watches the board**; this guide is the
> half of that contract written for the agent. It assumes the data model from
> [`VISION.md`](../VISION.md) and the human flow in [`WORKFLOW.md`](WORKFLOW.md) — it does not
> repeat them, it adds what is specific to the agentic actor.

This guide is **agent-neutral**: it is not about Claude Code, Cursor or any particular tool. Each
project wires it to its own tooling (see [Template for consumer projects](#template-for-consumer-projects)).

## What the agent may and may not do

**May:**

- **Create new tasks** — minimal frontmatter plus **tentative `zones` from day one** (they feed the
  overlap calculation even while rough).
- **Classify every task with the plugin's `type`** (canonical taxonomy, VISION §7.3). On leaves,
  evaluate **in this order — the first "yes" wins**:
  1. **`infra`** — plumbing, build, scripts, config, migration, docs the end user never sees.
  2. **`feat`** — adds a new capability.
  3. **`maint`** — fixes or improves something that already exists (bug or debt).

  `combo` is **not** part of this evaluation: it is declared when the task has children. Mind the
  order: build/docs/migration work is `infra` even if it "sounds like" a feature — that is why
  `infra` goes first. Do **not** confuse `type` with the project's id series (below): they are
  orthogonal axes — a `BUG-12` is `type: maint`, a `FEAT-3` is `type: feat`.
- **Mature the body and raise `maturity`** (`raw` → `draft` → `ready`) as the plan is documented and
  closed.
- **Register `absorbs` / `depends_on`** when an execution decision establishes them.

**May not:**

- **Close work means changing `status: done` and nothing else.** Do not move files, do not rename,
  do not touch queues to "archive", and **never delete the file in the act of closing** — deleting
  old `done` tasks is a separate, later phase
  ([end-of-life convention](WORKFLOW.md#end-of-life-of-done-tasks-deletion-convention)), always
  authorized explicitly by the human or run as a dedicated cleanup task.
- **Do not reorder a `lanes.yaml` `queue` on your own initiative** — order is the human's decision
  (VISION §4: *the system assists, it doesn't impose* — this applies to the agent too).
- **Do not invent `areas` / `zones` values** — it is a closed taxonomy. If a zone is missing,
  propose it to the human or add it to `taxonomy.yaml` as an explicit, declared change, never
  smuggled in.

## Id assignment

The plugin **mandates no prefix** — each project picks its own id series (the plugin's own demo uses
`TIME-` / `COMBO-`; a consumer may use `FEAT-`, `BUG-`, or whatever it prefers). The next id is the
**maximum of the relevant series + 1**; gaps are never reused (traceability).

## `absorbs` does not propagate maturity

If a `ready` task absorbs a `draft` one, the absorber is **not** 100% executable — declare it
`draft` until the absorbed part is promoted. Otherwise a combo can alert `maturity-too-low` because
the draft-ness comes from an absorbed task invisible to the derivation. *(Candidate for a future
derived alert: "`ready` absorber with a `raw` / `draft` absorbed task".)*

## Tools to "see" what the human sees on the board

The board is the human's window. The agent reads the **same derived state** through the **CLI
validator** (see the [README development section](../../README.md#development) for build and flags).

### The validator is the lint

Run it after each batch of writes and fix the alerts before considering the work closed:

```sh
node validate.js <vault>/roadmap --report --strict
```

`--strict` makes warnings fail the exit code too; `--json` emits machine-readable output; `--lang es`
switches messages to Spanish.

### Derived state: `--report`

`--report` prints the same derived state the human reads off the board:

- **Next by lane** — the next pickable task per lane.
- **Cross-lane gates** — dependencies that cross lanes, with their state.
- **Lane overlap** — pairs of lanes touching the same zones, with the percentage and the shared
  zones.
- **Counts** — backlog, per-lane and done.

With `--json --report` the payload is `{ alerts, report }` for tooling.

### How `next` is computed

The guide documents the exact algorithm so the agent understands what it reads (it matches
`buildModel.ts`):

1. The lane `queue` is **expanded to leaves** — a combo counts through its leaves, not as one entry.
2. **`next` = the first leaf with `status` other than `done` and not blocked**, where **blocked** =
   some `depends_on` is missing or not-`done`, **or** the block is inherited from its `parent`.

So a leaf can be pickable on its own data yet still blocked because its parent combo is blocked.

### Git integration

Per-lane git verification (checking integration before crossing a gate) is documented separately and
added once that work lands — this guide intentionally does not speculate about it yet.

## Template for consumer projects

The generic guide lives in RL; what is specific to a project lives in the project, without
duplicating. Add a short snippet to the consumer's `AGENTS.md` / rules pointing the agent at the
board. Write it **greenfield** (a project starting from scratch), in the plugin's vocabulary:

```markdown
## Roadmap (Roadmap Lanes)

- The roadmap lives in `roadmap/` — one `.md` per unit of work, plus `lanes.yaml` and
  `taxonomy.yaml`.
- Id series for this project: `FEAT-` / `BUG-` / `INFRA-`.  <!-- choose your own -->
- Agent contract: read RL's `AGENT_WORKFLOW.md` before touching the board.
- After each batch of writes, run the validator and clear its alerts:
  `node validate.js roadmap --report --strict`.
```

For an illustration of how a real consumer wired this, see the [appendix](#appendix-example-from-a-real-consumer).

## Non-goals

- Not the documentation of a concrete agent (Claude Code, Cursor…): this is the neutral contract;
  each project wires it to its tooling.
- Does not duplicate VISION or WORKFLOW: it references them. The guide only adds what is specific to
  the agentic actor.

## Appendix: example from a real consumer

Illustrative only — **not** the canonical template (that is written greenfield, above). This
consumer carries its own decisions that a new project does not have: it uses the `DT` / `FT` id
series (in RL that is free — a new project picks its own) and migrated from a manual index (hence the
"frozen historical index", which does not exist greenfield). Read it for the **shape** of the rules,
not those details:

> **Hard board rules**
> - One unit of work = one file that matures. The raw idea and the formal plan are the same `.md` at
>   different `maturity` (`raw` → `draft` → `ready`). Do not create parallel documents.
> - Close = `status: done` in the frontmatter, in the same commit as the work. Files are not moved,
>   not renamed, there is no manual board to sync.
> - The body holds the plan. Legitimate exception — a plan shared across N tasks: each task carries a
>   summary + pointer, and the shared document lives outside the roadmap folder.
> - `taxonomy.yaml` is a closed list: to extend it, edit the yaml on purpose, never invent values in
>   the task.
> - Order and lane live in `lanes.yaml`, not in the task. The agent does NOT reorder queues on its
>   own; hard dependencies go in `depends_on`.
> - Every live plan in the project exists as a task on the board: a plan with no task pointing to it
>   is an oversight — create the task.
>
> **Technical debt — hot annotation**
> - Debt is annotated hot when the problem shows up: create `DT-XXX.md` with minimal frontmatter
>   (`maturity: raw`, tentative `zones`, rough `duration`) and the finding as the body. No lane →
>   automatic backlog.
> - Sequence number: the next one after the maximum across the board and the project's frozen
>   historical index. Numbers are never reused.
> - Close by discard: `status: done` with the reason recorded in the body — traceability of
>   "evaluated and discarded".
