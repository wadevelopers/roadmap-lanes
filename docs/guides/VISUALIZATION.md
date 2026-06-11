# Visualizing the roadmap with the Obsidian graph

> 🇬🇧 English · [🇪🇸 Español](../guides.es/VISUALIZACION.md)

The Roadmap Lanes (RL) board is the main view. The Obsidian **graph** is a **complementary** view for
exploring the **relationships** between tasks (hierarchy and dependencies) and for coloring the roadmap
by its different axes.

There's no need to duplicate data: RL writes relationships as **wikilinks in the frontmatter**
(`parent`, `depends_on`, `absorbs`) and classification as **properties** (`type`, `status`, `maturity`,
`areas`, `zones`). The native graph and plugins read exactly those fields.

---

## 1. Native Obsidian graph

It shows notes as nodes and wikilinks as edges. Under `Graph settings → Groups` you create groups with
**property searches**:

```text
[type:feat]          # color by type: features…
[type:maint]         # …maintenance / tech debt…
[type:infra]         # …infrastructure
[type:combo]         # …groups/stages with children
[status:done]        # or focus by status
[maturity:raw]       # or by plan maturity
```

Useful filter syntax:

- `[parent]` — notes that **have** the `parent` property; `-[parent]` — those that **don't** (tree
  roots).
- `[parent:null]` — `parent` declared but empty.
- Compound groups: `[type:maint] [status:pending]`.

> Don't create groups for **every** combination of `type` × `status` × `maturity`: the count explodes
> and the graph becomes unmanageable. That's what Extended Graph is for (§2).

**Two limits of the native graph** (which Extended Graph solves):

1. **It doesn't know the meaning of each link.** To Obsidian, a link in `parent` and one in
   `depends_on` are the same: it doesn't label the edge as "parent", "depends on" or "absorbs".
2. **One color dimension at a time.** It can't show `type` + `status` + `maturity` together, and
   switching from one to another forces rewriting the groups by hand.

---

## 2. Extended Graph (recommended plugin)

[Extended Graph](https://github.com/ElsaTam/obsidian-extended-graph) (by ElsaTam, in the community
plugin gallery) lifts the two limits above and adds things that are very useful for RL.

### a) Colored, filterable link types

The **property name is the link type**: `parent`, `depends_on` and `absorbs` automatically become
distinct types. With that you can:

- **color each type** (e.g. `parent` blue, `depends_on` red, `absorbs` gray) and show its label on the
  edge;
- **filter/hide by type** — see, for example, **only** the hierarchy tree (`parent`) or **only** the
  dependencies (`depends_on`).

Solves limit 1 of the native graph.

### b) Properties as arcs (several dimensions at once)

Properties are drawn as **colored arcs around the node**, and several can be shown **at once** as
concentric rings. So you see `type` + `status` + `maturity` **simultaneously**, without picking just
one. The color comes from a palette or is assigned by value by hand; a legend lets you toggle values
(and filters the nodes). Solves limit 2.

### c) Graph states (saved views with a selector)

You save a **named configuration** (which properties and link types are active, colors, etc.) and
**switch between them with a selector**. For example states *"By type"*, *"By status"*, *"By maturity"*,
*"Dependencies"* — one click to switch focus.

> Changes **aren't saved automatically**: you have to save them explicitly. There's a configurable
> default state and initial state.

### d) Node size = task duration

You can size each node by a **numeric property**. Pointing it at **`duration`** (which in RL is a
**number of hours, no suffix**), **a bigger node = more work**: at a glance you see which tasks weigh
more. *(This is one of the reasons `duration` is declared as a plain number and not `5d`/`4h`.)* You can
also size by number of backlinks or centrality, to highlight heavily connected "hub" tasks.

### e) Extras

Node shapes by property, focus on a node, pinning positions and exporting the graph to SVG.

---

## 3. Bases (tables, native)

For **tabular** views of the roadmap (filter by `type`/`status`/`area`, group, sort), Obsidian already
ships **Bases** — no external plugin needed. It reads the same frontmatter as RL, so a base over the
roadmap folder gives tables and queries with no extra data setup.

---

## 4. Why the format feeds all this without duplicating data

That the frontmatter wikilinks serve **at once** for RL, the graph, backlinks and Bases is a design
decision explained in [`VISION.md` §8](../VISION.md). This guide only brings that down to the
practical graph configuration.

---

## References

- Obsidian graph: https://obsidian.md/help/plugins/graph
- Search by properties: https://obsidian.md/help/plugins/search
- Extended Graph (wiki): https://github.com/ElsaTam/obsidian-extended-graph/wiki
- Bases: https://help.obsidian.md/bases
