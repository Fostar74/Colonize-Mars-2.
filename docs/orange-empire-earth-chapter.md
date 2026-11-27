# Orange Empire gameplay and the Earth chapter

## Mines and formations

The map maintains 20 visible external deposits per resource. Existing deposits and claims retain their coordinates. Each NPC external lease reserves real troops and excludes human and NPC claimants until settlement. The Empire also builds and works one shared alliance mine, using the construction work, cargo, stock, and gathering rules used by human alliance mines. Returning troops and resources are written in the same transaction that clears their lease. NPCs have no alliance shop or human alliance point awards.

NPC commanders compare three range-aware formations once per UTC day with at most twelve simulator rounds per comparison. Practice samples use their own available units. Actual Orange Empire battles record aggregate plan outcomes and category performance and losses. The commanders share those lessons, using them to select practice plans and training order. They never query a human army to choose how to deploy.

## Combat XP

Player-versus-player and Orange Empire battles award the sum of shared training costs for enemy troops actually killed, multiplied by `COMBAT_XP_MULTIPLIER` (default 1). In-battle restorations and hospital survivors do not count as kills. Deaths are shared among participating owners in proportion to their contribution, with deterministic rounding. Settlement and XP credit commit together. Existing event XP, loot and hospital rules continue to apply. Campaign-only alien templates have no shared training prices. The current repository also has no direct mine-versus-mine combat route. Existing human-versus-human battle routes still operate independently.

## Earth victory

The existing seven-day alliance spaceport project is the completion milestone for the Mars spaceship. There is no separate spaceship project. The completion and award are atomic. The earliest scheduled completion wins, with the lower station ID breaking an exact tie. The winning alliance member with the highest stored player XP at settlement receives the permanent Defender of the Earth title. Tied XP goes to the lower player ID. The winner and title persist if the holder later leaves the alliance or the alliance renames. Stations already marked built before this change lack the timestamps needed to reconstruct a historical race, so the award applies to the first recorded completion.

Production keeps `ORANGE_EMPIRE_ATTACKS_ENABLED=false`.
