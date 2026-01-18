# World Tables

## Client world table (authoritative, index-based)
Source: client g_WorldTable dump (CShell.dll). WORLD_ID is treated as 1-based index.

| id | class | default folder | default display | loads as | valid | notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0 | NY_Manhattan | NYC - Manhattan | NY_Manhattan | yes | |
| 2 | 1 | NY_Brooklyn | NYC - Brooklyn | NY_Brooklyn | yes | |
| 3 | 0 | tokyo | Tokyo - Upper | tokyo | yes | |
| 4 | 0 | apartments | Apartments | apartments | yes | |
| 5 | 5 | null | Earth | null | no | folder null (missing world) |
| 6 | 2 | necarsfield | Necars Field | necarsfield | yes | |
| 7 | 0 | Paris | Paris | Paris | yes | |
| 8 | 2 | testing | Testing | null | no | no world (testing entry) |
| 9 | 2 | Berlin | Berlin | Berlin | yes | |
| 10 | 5 | lowertokyo | Tokyo - Lower | lowertokyo | yes | |
| 11 | 4 | AndromedaCity | Andromeda City | AndromedaCity | yes | |
| 12 | 0 | Newhaven | New Haven | Newhaven | yes | |
| 13 | 4 | ganymede | Ganymede | null | no | no world (ganymede entry) |
| 14 | 0 | DeMorgan | DeMorgans Castle | DeMorgan | yes | |
| 15 | 3 | keplersdome | Keplers Dome | keplersdome | yes | |
| 16 | 0 | Moonbase | Moon Base | Moonbase | yes | |
| 17 | 1 | Genesis | STS Genesis | null | no | no world (Genesis entry / space station missing) |
| 18 | 3 | NY_GroundZero | NYC - Ground Zero | NY_GroundZero | yes | |
| 19 | 0 | BookersValley | Bookers Valley | BookersValley | yes | |
| 20 | 3 | epsiloneridani | Epsilon Eridani | null | no | no world (epsiloneridani entry) |
| 21 | 0 | TerraVentureI | Terra Venture I | TerraVentureI | yes | |
| 22 | 0 | DominionExodus | Dominion Exodus | null | no | no world (DominionExodus entry) |
| 23 | 4 | EspenParadise | Espen Paradise | null | no | no world (EspenParadise entry) |
| 24 | 5 | Aquatica | Aquatica | Aquatica | yes | |
| 25 | 3 | Pegasi51 | Pegasi 51 | Pegasi51 | yes | |
| 26 | 0 | Aurelia | Aurelia | Aurelia | yes | |
| 27 | 0 | PaxPrime | Pax Prime | PaxPrime | yes | |
| 28 | 3 | ceresdelta | Ceres Delta | ceresdelta | yes | |
| 29 | 0 | titanstation | Titan Station | titanstation | yes | |
| 30 | 0 | CloneFac | Cloning Facility | CloneFac | yes | |
| 31 | 0 | TrainingCenter | Training Center | TrainingCenter | yes | |
| 32 | 4 | null | null | null | no | empty slot |

Notes:
- Class values are raw table values (0–5). Mapping to UI strings (CLASS I–V WORLD) is not yet validated.
- `default folder/display` are the strings stored in the client table; `loads as` is based on manual travel tests.

## APARTMENT_WORLD_TABLE

| id | folder |
| --- | --- |
| 1 | city_1 |
| 2 | colony_dirty_1 |
| 3 | colony_1 |
| 4 | city_paris_1 |
| 5 | tokyo_1 |
| 6 | colony_aqua_1 |
| 7 | city_2 |
| 8 | colony_dirty_2 |
| 9 | colony_2 |
| 10 | city_paris_2 |
| 11 | tokyo_2 |
| 12 | colony_aqua_2 |
| 13 | colony_dirty_3 |
| 14 | colony_3 |
| 15 | city_paris_3 |
| 16 | tokyo_3 |
| 17 | colony_aqua_3 |
| 18 | hq_cl |
| 19 | hq_gd |
| 20 | hq_co |
| 21 | spaceship |
| 22 | ci_prison_duel |
| 23 | backer_pent |
