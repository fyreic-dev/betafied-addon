import { world, system, Dimension, Player } from "@minecraft/server";
import { eventBus } from "../core/eventBus.js";
import { reportError } from "../core/errorReporter.js";

const CONFIG = Object.freeze({
    RANGE: 1000,
    MAX_ATTEMPTS: 15,
    WAIT_TICKS: 40,
    MIN_Y: 50,
    MAX_Y: 120
});

const BAD_BLOCKS = Object.freeze(new Set([
    "minecraft:water",
    "minecraft:flowing_water",
    "minecraft:lava",
    "minecraft:flowing_lava",
    "minecraft:air",
    "minecraft:powder_snow",
    "minecraft:cactus",
    "minecraft:magma"
]));

let spawnInProgress = false;
let activeSpawningPlayerId: string | null = null;

function resetSpawnLock(): void {
    spawnInProgress = false;
    activeSpawningPlayerId = null;
}

function isSpawnSet(): boolean {
    return world.getDynamicProperty("betafied:spawn_init") === true;
}

function getRandomCoord(): number {
    return Math.floor(Math.random() * (CONFIG.RANGE * 2)) - CONFIG.RANGE;
}

function findSurface(dim: Dimension, x: number, z: number): number | null {
    for (let y = CONFIG.MAX_Y; y > CONFIG.MIN_Y; y--) {
        try {
            const block = dim.getBlock({ x, y, z });
            if (!block || block.isAir) continue;

            const type = block.typeId;
            if (BAD_BLOCKS.has(type)) return null;

            const above1 = dim.getBlock({ x, y: y + 1, z });
            const above2 = dim.getBlock({ x, y: y + 2, z });

            if (above1?.isAir && above2?.isAir) {
                return y + 1;
            }

            return null;
        } catch (e) {
            reportError({
                system: "worldSpawn",
                operation: "inspectSurfaceBlock",
                target: `${x},${y},${z}`
            }, e);
            return null;
        }
    }
    return null;
}

function attemptSpawn(player: Player, attempt = 1): void {
    if (!player.isValid) {
        resetSpawnLock();
        return;
    }

    if (attempt > CONFIG.MAX_ATTEMPTS) {
        player.teleport({ x: 0.5, y: 80, z: 0.5 });
        player.addTag("spawned");

        try {
            world.setDefaultSpawnLocation({ x: 0, y: 80, z: 0 });
            world.setDynamicProperty("betafied:spawn_init", true);
        } catch (e) {
            reportError({
                system: "worldSpawn",
                operation: "setDefaultSpawnFallback"
            }, e);
        }
        resetSpawnLock();
        return;
    }

    const tx = getRandomCoord();
    const tz = getRandomCoord();

    player.teleport({ x: tx, y: 130, z: tz });
    player.addEffect("resistance", 200, { amplifier: 255, showParticles: false });

    system.runTimeout(() => {
        if (!player.isValid) {
            resetSpawnLock();
            return;
        }

        const surfaceY = findSurface(player.dimension, tx, tz);

        if (surfaceY === null) {
            attemptSpawn(player, attempt + 1);
            return;
        }

        try {
            world.setDefaultSpawnLocation({ x: tx, y: surfaceY, z: tz });
            world.setDynamicProperty("betafied:spawn_init", true);
        } catch (e) {
            reportError({
                system: "worldSpawn",
                operation: "setDefaultSpawnCalculated",
                target: `${tx},${surfaceY},${tz}`
            }, e);
        }

        player.teleport({ x: tx + 0.5, y: surfaceY, z: tz + 0.5 });
        player.addTag("spawned");
        resetSpawnLock();

    }, CONFIG.WAIT_TICKS);
}

eventBus.onPlayerSpawn((ev) => {
    const { player, initialSpawn } = ev;

    if (!initialSpawn || player.hasTag("spawned")) return;

    if (isSpawnSet()) {
        player.addTag("spawned");
        return;
    }

    if (spawnInProgress) {
        return;
    }

    spawnInProgress = true;
    activeSpawningPlayerId = player.id;
    attemptSpawn(player);
});

eventBus.onPlayerLeave((ev) => {
    if (!isSpawnSet() && (activeSpawningPlayerId === ev.playerId || activeSpawningPlayerId === null)) {
        resetSpawnLock();
    }
});
