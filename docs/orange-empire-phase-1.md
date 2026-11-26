# The Orange Empire Phase 1

## Integration

| Area | Existing integration | Phase 1 behavior |
| --- | --- | --- |
| Persistence and alliance | Human memberships and sessions reference `users`. | A singleton NPC alliance owns ten commanders in additive SQLite tables. Commander 10 is the Emperor. Each commander has its own position, clock, resources, jobs, army, unit upgrades, XP, Cyber Knight and protocols. |
| World map | `placedMapObjects` feeds player spawns and both mine allocators. The authenticated `/map/bases` endpoint feeds the map. | Seeded NPC positions participate in placement checks. Orange markers and a bilingual navigation list use a distinct NPC target type. |
| Economy | `src/shared/unitEconomy.js` provides unit prices, building requirements and durations, and training and upgrade data. The player runtime supplies the production cadence and the protocol catalog. | The NPC scheduler advances the economy every ten seconds. Paid jobs and production carry survive restarts. SQLite serializes seed and update transactions, and stored timestamps prevent crediting a tick twice. After downtime, production catches up through at most 24 hours and already paid jobs complete once. New jobs start at the current tick. |
| Levels and garrisons | The player level function caps at 40. Existing campaign garrisons provide encounter strength references. | Commanders use the same XP curve to a cap of 45. Preview garrisons use the existing campaign headcounts for tiers 11–20 with corresponding trainable units. Home armies have no march cap. The knight record starts at level 1. |
| Combat | The campaign timeline settles arrivals and returns in timestamp order. PvP settlement uses the shared battle engine, player protection, and per-player casualty and report writes. | Phase 1 exposes pure level/protection and population checks for future use. NPC map targets have no mission actions or combat endpoints. |

## Future attack and defense design

- Add a durable NPC attack schedule and march table, with a unique dispatch key for each approved scheduling slot. Reserve troops and create the march in the same transaction. At dispatch, verify the destination is a human base and the player is at the configured human max level, regardless of alliance. Apply beginner and shield protection and check protection again at arrival. Assign the earliest slots to weaker commanders and increase strength over time.
- The Emperor's dispatch gate must require a completed alliance base. A human alliance base becomes a strategic target when its spaceport construction begins. Join this state through `alliance_space_stations` and account for the existing transition from `building` to `built`, which clears the start timestamp. Define station targeting and eligible defenders before enlisting stations in the scheduler.
- Limit the outgoing march to 50,000 population using shared unit profiles. Use five minutes per map tile and persist the computed arrival and return times. Confirm the distance metric for diagonal tiles. Settle alongside the existing campaign timeline with reinforcement arrivals due at the same time resolved first.
- Existing alliance reinforcement delivery adds troops to the recipient's army. Future defensive reinforcements need stationed contingents with their own owner, arrival, recall and survivors. Reserve up to three concurrent slots atomically. At battle time include arrived contingents with the unrestricted home defense. Preserve each owner's formation and combat modifiers, allocate casualties and wounds by owner, and return survivors to the owner only once. Keep existing deliveries intact when introducing stationed reinforcements.

## Owner decisions before combat

Confirm whether two attacks weekly are global or per eligible player. Confirm loot, reconnaissance, mines, final commander names, production balance, garrison balance, knight progression and equipment, and escalation rates. The Phase 1 preview uses existing human prices, production, training and upgrade timings with a simple queue policy. The temporary garrison templates and one active job per queue are preview choices. Knight strength and the rules for station eligibility and choosing among reinforcement volunteers need approval before combat.

## Migration and rollback

The server creates the two NPC tables on startup. With `ORANGE_EMPIRE_ENABLED` unset or any value other than `true`, seeding, progression and map exposure are disabled. Set it to `true` only on a test instance with a persistent SQLite path to preview the faction. Seed placement and all ten inserts commit together. If there is insufficient room, the transaction rolls back and the scheduler logs the error.

Disable the feature and restart to roll back the preview while retaining progress and map reservations. Re-enabling resumes from the stored clock with the same catch-up limit. Keep the tables during a version rollback to retain a recovery copy. A version predating this change does not reserve NPC tiles, so restore or reconcile those positions before re-enabling if any bases or mines were placed while running that version.
