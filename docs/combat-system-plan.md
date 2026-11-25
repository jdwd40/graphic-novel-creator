# Combat System Implementation Plan

Last updated: 25 November 2026

The combat system in [combat-system-spec.md](combat-system-spec.md) is built in seven milestones and 35 tickets: 30 pieces of work and 5 design decisions. The engine comes first as pure logic with tests, so the rules are proven before any screen exists.

## Approach

- **Engine before interface.** Milestones 1 and 2 produce a resolver and a simulation runner that need no user interface or database. Every later milestone calls them.
- **The spec's balance table is the regression suite.** The five simulated results in the simulation ticket must keep passing. If one changes, either the engine or the spec is wrong.
- **Each milestone is usable on its own.** After milestone 3 a creator can build a fight. After milestone 4 a reader can play one. Milestones 5 and 6 add depth, not prerequisites.
- **Built with AI coding tools.** The code is written by AI and directed by one person. Each ticket's scope and acceptance criteria are written to be handed over as a prompt and checked as tests, so that person's time goes on reviewing, deciding, integrating and playtesting.
- **Decisions are tickets.** The spec's open questions are filed as issues labelled `decision`, each with options and a recommendation, and placed in the milestone they affect.

## Assumptions

- The repository currently holds only a licence. The first ticket imports the existing app or scaffolds a new one.
- The stack is React, Vite and TypeScript, with `@xyflow/react` v12 for the story map and a Postgres-backed store.
- The engine lives in `src/combat/` and imports nothing from React, the story map library or the database client.
- Tickets for the builder, the player and storage were written against the spec, not the code. Their storage details need adjusting to the app's real schema once it is in the repository.

## Milestones

| Milestone | Done when | Tickets | Your days, AI-assisted | Where your time goes |
| --- | --- | --- | --- | --- |
| [M0 Foundations](https://github.com/jdwd40/graphic-novel-creator/milestone/1) | The app code and a test runner are in the repository. | 1 | 0.5 | Getting the app into the repository and checking it runs |
| [M1 Combat engine](https://github.com/jdwd40/graphic-novel-creator/milestone/2) | A pure, tested resolver that can play any fight from the spec without a user interface. | 7 | 1 | Reviewing the resolver against the resolution table |
| [M2 Balance preview](https://github.com/jdwd40/graphic-novel-creator/milestone/3) | Autopilot and careful readers can be simulated for any encounter and shown to a creator. | 3 | 0.5 to 1 | Checking the simulated results match the spec |
| [M3 Encounter node in the builder](https://github.com/jdwd40/graphic-novel-creator/milestone/4) | A creator can add an encounter to the story map, configure it with three fields and wire its exits. | 5 | 1.5 to 2 | Fitting generated code to the app's real schema and story map |
| [M4 Combat screen](https://github.com/jdwd40/graphic-novel-creator/milestone/5) | A reader can play a fight on a phone and leave by the correct exit. | 7 | 2 to 3 | Playtesting on a phone and iterating on feel |
| [M5 Modifiers and moments](https://github.com/jdwd40/graphic-novel-creator/milestone/6) | Story flags, items and choices change fights, and fights change the story. | 7 | 1.5 to 2.5 | Using the editor as a creator would and fixing what is awkward |
| [M6 Bosses and polish](https://github.com/jdwd40/graphic-novel-creator/milestone/7) | Boss fights with phases, art variants and the end-of-fight page. | 5 | 1.5 to 2.5 | Tuning boss numbers and judging the art changes |

The day figures are rough guesses at one person's time when AI writes the code, and total roughly 8 to 12 days. They are not measured from anything, and they exclude the five decisions and any art.

Ticket sizes compare tickets with each other and are not time estimates. S is one focused change, M touches several files or needs careful tests, and L spans the engine, the builder and the player or has a large interface. There are 11 small, 17 medium and 2 large tickets.

## Order of work

```mermaid
flowchart LR
  M0["M0 Foundations"] --> M1["M1 Combat engine"]
  M1 --> M2["M2 Balance preview"]
  M1 --> M3["M3 Encounter node"]
  M2 --> M3
  M3 --> M4["M4 Combat screen"]
  M4 --> M5["M5 Modifiers and moments"]
  M5 --> M6["M6 Bosses and polish"]
```

Milestone 3 depends on milestone 2 only because the encounter inspector embeds the balance preview. Within milestone 4, player state and equipment can start as soon as the combat types exist.

## Decisions to make

| Issue | Decision | Recommendation | Needed for |
| --- | --- | --- | --- |
| [#2](https://github.com/jdwd40/graphic-novel-creator/issues/2) | Armour as a per-fight buffer or as damage reduction | Keep the buffer. Every number in the spec's balance table was simulated with it. | Beat resolution |
| [#3](https://github.com/jdwd40/graphic-novel-creator/issues/3) | What retreating costs | Keep one free Strike as the default, and leave per-encounter pricing until a creator asks for it. | Fight lifecycle |
| [#11](https://github.com/jdwd40/graphic-novel-creator/issues/11) | Whether fights need a beat cap | Start with no cap. Use the simulation runner to check whether the guard-heavy policy beats careful play anywhere else before adding a rule. | Nothing yet |
| [#17](https://github.com/jdwd40/graphic-novel-creator/issues/17) | Enemy health as exact pips or a described state | Ship exact pips. Revisit a described state as a boss rule-break rather than a global setting. | Combat screen layout |
| [#28](https://github.com/jdwd40/graphic-novel-creator/issues/28) | A standard rest effect for restoring health | Add the rest effect and the validation hint. Avoid automatic recovery. | Nothing yet |

The sixth open question in the spec, simulating boss numbers, is work rather than a decision and is filed as a ticket in milestone 6.

## Risks

| Risk | Effect | Mitigation |
| --- | --- | --- |
| The app's real data model differs from what the tickets assume | Storage and builder tickets need rework | Review milestone 3 tickets as soon as the app code is imported |
| Creators do not write captions | Fights read as repetitive | Built-in caption pools ship in milestone 1, and no caption is ever required |
| Balance drifts as features are added | Autopilot stops winning Standard fights | The five simulated results run as tests on every pull request |
| Boss numbers are untested | Boss fights are too long or unwinnable | A simulation and tuning ticket closes milestone 6 before bosses are offered to creators |
| Scope grows toward a full RPG | Combat becomes a second game | The spec's out-of-scope table is the test for any new mechanic |

## Tickets

### M0 Foundations

| Issue | Ticket | Size | Depends on |
| --- | --- | --- | --- |
| [#1](https://github.com/jdwd40/graphic-novel-creator/issues/1) | Import the existing app or scaffold the project | M | None |

### M1 Combat engine

| Issue | Ticket | Size | Depends on |
| --- | --- | --- | --- |
| [#2](https://github.com/jdwd40/graphic-novel-creator/issues/2) | Decide: armour as a per-fight buffer or as damage reduction | Decision | None |
| [#3](https://github.com/jdwd40/graphic-novel-creator/issues/3) | Decide: what retreating costs | Decision | None |
| [#4](https://github.com/jdwd40/graphic-novel-creator/issues/4) | Define combat types, presets and constants | S | [#1](https://github.com/jdwd40/graphic-novel-creator/issues/1) |
| [#5](https://github.com/jdwd40/graphic-novel-creator/issues/5) | Implement beat resolution | M | [#4](https://github.com/jdwd40/graphic-novel-creator/issues/4), [#2](https://github.com/jdwd40/graphic-novel-creator/issues/2) |
| [#6](https://github.com/jdwd40/graphic-novel-creator/issues/6) | Implement the fight lifecycle and exits | M | [#5](https://github.com/jdwd40/graphic-novel-creator/issues/5), [#3](https://github.com/jdwd40/graphic-novel-creator/issues/3) |
| [#7](https://github.com/jdwd40/graphic-novel-creator/issues/7) | Tells and caption selection | M | [#5](https://github.com/jdwd40/graphic-novel-creator/issues/5) |
| [#8](https://github.com/jdwd40/graphic-novel-creator/issues/8) | Seeded pattern variation for shifty enemies | S | [#6](https://github.com/jdwd40/graphic-novel-creator/issues/6) |

### M2 Balance preview

| Issue | Ticket | Size | Depends on |
| --- | --- | --- | --- |
| [#9](https://github.com/jdwd40/graphic-novel-creator/issues/9) | Simulation runner with autopilot and careful readers | M | [#6](https://github.com/jdwd40/graphic-novel-creator/issues/6) |
| [#10](https://github.com/jdwd40/graphic-novel-creator/issues/10) | Balance preview panel | M | [#9](https://github.com/jdwd40/graphic-novel-creator/issues/9) |
| [#11](https://github.com/jdwd40/graphic-novel-creator/issues/11) | Decide: whether fights need a beat cap | Decision | [#9](https://github.com/jdwd40/graphic-novel-creator/issues/9) |

### M3 Encounter node in the builder

| Issue | Ticket | Size | Depends on |
| --- | --- | --- | --- |
| [#12](https://github.com/jdwd40/graphic-novel-creator/issues/12) | Store encounters in the story data model | M | [#4](https://github.com/jdwd40/graphic-novel-creator/issues/4) |
| [#13](https://github.com/jdwd40/graphic-novel-creator/issues/13) | Encounter node on the story map | M | [#12](https://github.com/jdwd40/graphic-novel-creator/issues/12) |
| [#14](https://github.com/jdwd40/graphic-novel-creator/issues/14) | Encounter inspector: required fields and presets | M | [#13](https://github.com/jdwd40/graphic-novel-creator/issues/13), [#10](https://github.com/jdwd40/graphic-novel-creator/issues/10) |
| [#15](https://github.com/jdwd40/graphic-novel-creator/issues/15) | Caption editor for encounters | S | [#14](https://github.com/jdwd40/graphic-novel-creator/issues/14), [#7](https://github.com/jdwd40/graphic-novel-creator/issues/7) |
| [#16](https://github.com/jdwd40/graphic-novel-creator/issues/16) | Validation rules for encounters | S | [#13](https://github.com/jdwd40/graphic-novel-creator/issues/13) |

### M4 Combat screen

| Issue | Ticket | Size | Depends on |
| --- | --- | --- | --- |
| [#17](https://github.com/jdwd40/graphic-novel-creator/issues/17) | Decide: enemy health as exact pips or a described state | Decision | None |
| [#18](https://github.com/jdwd40/graphic-novel-creator/issues/18) | Player combat state and equipment | M | [#4](https://github.com/jdwd40/graphic-novel-creator/issues/4) |
| [#19](https://github.com/jdwd40/graphic-novel-creator/issues/19) | Combat screen layout | M | [#18](https://github.com/jdwd40/graphic-novel-creator/issues/18), [#7](https://github.com/jdwd40/graphic-novel-creator/issues/7), [#17](https://github.com/jdwd40/graphic-novel-creator/issues/17) |
| [#20](https://github.com/jdwd40/graphic-novel-creator/issues/20) | Play a fight: beat flow and exits | M | [#19](https://github.com/jdwd40/graphic-novel-creator/issues/19), [#6](https://github.com/jdwd40/graphic-novel-creator/issues/6), [#12](https://github.com/jdwd40/graphic-novel-creator/issues/12) |
| [#21](https://github.com/jdwd40/graphic-novel-creator/issues/21) | Hit feedback without numbers | S | [#20](https://github.com/jdwd40/graphic-novel-creator/issues/20) |
| [#22](https://github.com/jdwd40/graphic-novel-creator/issues/22) | Save and resume a fight in progress | S | [#20](https://github.com/jdwd40/graphic-novel-creator/issues/20) |
| [#23](https://github.com/jdwd40/graphic-novel-creator/issues/23) | Auto-advance reader setting | S | [#20](https://github.com/jdwd40/graphic-novel-creator/issues/20) |

### M5 Modifiers and moments

| Issue | Ticket | Size | Depends on |
| --- | --- | --- | --- |
| [#24](https://github.com/jdwd40/graphic-novel-creator/issues/24) | Shared condition evaluator | S | [#4](https://github.com/jdwd40/graphic-novel-creator/issues/4) |
| [#25](https://github.com/jdwd40/graphic-novel-creator/issues/25) | Apply modifiers at fight start | M | [#24](https://github.com/jdwd40/graphic-novel-creator/issues/24), [#6](https://github.com/jdwd40/graphic-novel-creator/issues/6) |
| [#26](https://github.com/jdwd40/graphic-novel-creator/issues/26) | Moments: triggers and choices in the engine | M | [#25](https://github.com/jdwd40/graphic-novel-creator/issues/25) |
| [#27](https://github.com/jdwd40/graphic-novel-creator/issues/27) | Exit effects, wounds and manner flags | M | [#6](https://github.com/jdwd40/graphic-novel-creator/issues/6), [#18](https://github.com/jdwd40/graphic-novel-creator/issues/18) |
| [#28](https://github.com/jdwd40/graphic-novel-creator/issues/28) | Decide: a standard rest effect for restoring health | Decision | [#27](https://github.com/jdwd40/graphic-novel-creator/issues/27) |
| [#29](https://github.com/jdwd40/graphic-novel-creator/issues/29) | Editor for modifiers, moments and custom exits | L | [#14](https://github.com/jdwd40/graphic-novel-creator/issues/14), [#25](https://github.com/jdwd40/graphic-novel-creator/issues/25), [#26](https://github.com/jdwd40/graphic-novel-creator/issues/26), [#27](https://github.com/jdwd40/graphic-novel-creator/issues/27) |
| [#30](https://github.com/jdwd40/graphic-novel-creator/issues/30) | Moment choices on the combat screen | S | [#26](https://github.com/jdwd40/graphic-novel-creator/issues/26), [#20](https://github.com/jdwd40/graphic-novel-creator/issues/20) |

### M6 Bosses and polish

| Issue | Ticket | Size | Depends on |
| --- | --- | --- | --- |
| [#31](https://github.com/jdwd40/graphic-novel-creator/issues/31) | Boss phases | L | [#26](https://github.com/jdwd40/graphic-novel-creator/issues/26), [#29](https://github.com/jdwd40/graphic-novel-creator/issues/29) |
| [#32](https://github.com/jdwd40/graphic-novel-creator/issues/32) | Boss rule-breaks and other ways to win | M | [#31](https://github.com/jdwd40/graphic-novel-creator/issues/31) |
| [#33](https://github.com/jdwd40/graphic-novel-creator/issues/33) | Simulate and tune boss numbers | S | [#32](https://github.com/jdwd40/graphic-novel-creator/issues/32), [#9](https://github.com/jdwd40/graphic-novel-creator/issues/9) |
| [#34](https://github.com/jdwd40/graphic-novel-creator/issues/34) | Art variants | S | [#19](https://github.com/jdwd40/graphic-novel-creator/issues/19), [#14](https://github.com/jdwd40/graphic-novel-creator/issues/14) |
| [#35](https://github.com/jdwd40/graphic-novel-creator/issues/35) | End-of-fight page | M | [#20](https://github.com/jdwd40/graphic-novel-creator/issues/20) |
