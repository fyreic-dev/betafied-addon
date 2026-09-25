# Betafied

**Betafied** is a Minecraft: Bedrock Edition behavior and resource pack project designed to recreate the mechanics, gameplay dynamics, and terrain aesthetics of **Minecraft Beta 1.7.3**.

---

## Architecture & Subsystem Decomposition

The codebase is organized into distinct Behavior Pack (`packs/BP`) and Resource Pack (`packs/RP`) layers, compiled via [Regolith](https://bedrock-oss.github.io/regolith/).

### Execution & Lifecycle Model

The TypeScript runtime uses a **pure side-effect self-registration pattern**:
- `packs/BP/scripts/main.ts` serves as the central orchestration entry point. It imports modular subsystem controllers in order.
- Each subsystem module subscribes to Minecraft Script API events (`world.beforeEvents`, `world.afterEvents`, `system.runInterval`, `system.runJob`) during module evaluation.
- No singleton objects are exported unless explicitly consumed across modules, keeping public surfaces clean and preventing circular dependencies.

### Subsystem Breakdown

#### 1. Core Infrastructure (`packs/BP/scripts/core/`)
- `eventBus.ts` / `tickManager.ts`: Single-entrance event dispatch and the master tick scheduler.
- `compatibilityPolicy.ts`: Central registry for terrain block replacements, inventory item conversions, entity drop mappings, and shared entity compatibility predicates.
- `betaRegistry.ts` / `normalizer.ts`: Canonical Beta allowlist plus the heuristic converters projecting modern items, blocks, and drops back onto it.
- `permissions.ts`: Central authorization and role validation (e.g., `PRIVILEGED_TAGS.BUILDER_EXEMPT`) with rate-limited audit logging.
- `errorReporter.ts`: Centralized diagnostic logging and error boundary helpers (`reportError`, `runCatching`).
- `inventoryManager.ts`: Generator-driven inventory scanner restricting items and mechanics not present in Beta 1.7.3.

#### 2. Player Systems (`packs/BP/scripts/player/`)
- `playerState.ts`: Per-player tick loop stripping offhand items and resetting XP to mirror Beta.
- `foodAndHealth.ts`: Instant health restoration when consuming food (disabling the modern hunger system).
- `welcome.ts`: Player join notification and version announcement.
- `achievements.ts`: In-game milestone tracking.

#### 3. Combat (`packs/BP/scripts/combat/`)
- `armor.ts`: Beta-accurate linear armor damage reduction formula.
- `machineGunBow.ts`: Classic rapid-fire bow mechanics.

#### 4. Interactions (`packs/BP/scripts/interactions/`)
- `placement.ts`: Beta block placement rules, reach distance enforcement, waterlog prevention, and interaction validation.
- `instantBonemeal.ts`: Instant crop maturation from bone meal.
- `fenceConnectivity.ts`: Classic fence connection rules.
- `furnaceMinecart.ts`: Coordinated scheduler managing fuel state, movement physics, rail checking, and collision impulses.
- `boatCollision.ts`: Restores classic wooden boat impact destruction and drop behavior.
- `swordMining.ts` / `redstoneMining.ts`: Tool-specific block breaking mechanics (cobweb fast-breaking, redstone mining fatigue).

#### 5. World & Terrain (`packs/BP/scripts/world/`)
- `worldBorder.ts`: World boundary enforcement (radius 4000).
- `worldSpawn.ts`: World spawn coordinator locating solid, hazard-free ground on initial world creation.
- `buildHeightLimit.ts`: Enforces the classic 128-block build ceiling.
- `dimensionBoundary.ts`: Blocks entry to The End, which does not exist in Beta 1.7.3.
- `netherSpawnProtection.ts`: Transition resistance preventing Nether portal entry damage.
- `chunkScrubber.ts`: Scans loaded chunks to replace modern blocks with Beta 1.7.3 equivalents.
- `ruinedPortalScrubber.ts`: Removes world-generated ruined portal blocks (crying obsidian, magma).
- `classicFog.ts`: Atmospheric density adjustments mimicking early Beta fog distance.
- `netherIce.ts`: Prevents water creation in the Nether while preserving classic ice block placement.
- `island.ts`: Void boundary safety island in The End for trapped entities.

#### 6. Mobs (`packs/BP/scripts/mobs/`)
- `entitySpawnHandler.ts`: Whitelist-based mob spawn validation and legacy drop replacement (e.g., zombies dropping feathers).
- `entityCleaner.ts`: Generator-driven cleanup job removing modern mob species from loaded chunks.
- `betaAnimalAI.ts`: Passive mob wander behaviors and persistence adjustments.
- `pigmanEquipment.ts`: Equips spawned zombie pigmen with the golden sword they always carried.
- `nightmares.ts`: Beta-authentic sleep disturbance mechanics spawning monsters if beds are inadequately lit.

---

## Development & Build Tooling

### Prerequisites
- Node.js 18+
- Python 3.11+ (for desloppify and Regolith filters)

### Scripts
- `npm run check`: Executes typechecking, linting, and the full test suite.
- `npm run typecheck`: Validates TypeScript compilation (`tsc --noEmit`).
- `npm run lint`: Runs ESLint on `packs/BP/scripts`.
- `npm run build`: Executes the Regolith compiler build.
- `npm run watch`: Watches for local changes and rebuilds.
