import { world, system, Block, Player, Vector3 } from "@minecraft/server";
import { eventBus } from "../core/eventBus.js";
import { reportError } from "../core/errorReporter.js";

const CONFIG = Object.freeze({
    NIGHT_START: 13000,
    NIGHT_END: 23000,
    CHECK_RADIUS: 13,
    Y_RANGE_DOWN: 3,
    Y_RANGE_UP: 7,
    INTERACTION_WINDOW: 20,
    SPAWN_DELAY: 1
});

const LIGHT_SOURCES = Object.freeze(new Set([
    "minecraft:torch",
    "minecraft:wall_torch",
    "minecraft:glowstone",
    "minecraft:lit_redstone_lamp",
    "minecraft:jack_o_lantern",
    "minecraft:lantern",
    "minecraft:soul_torch",
    "minecraft:soul_lantern"
]));

const NIGHTMARE_MOBS = Object.freeze(["minecraft:zombie", "minecraft:skeleton"] as const);

interface BedInteraction {
    count: number;
    player: Player;
    block: Block;
    windowExpired: boolean;
    scanComplete: boolean;
    hasLight: boolean | null;
}

const bedInteractions = new Map<string, BedInteraction>();

function isNight(): boolean {
    const time = world.getTimeOfDay();
    return time >= CONFIG.NIGHT_START && time <= CONFIG.NIGHT_END;
}

function isNearBed(player: Player, bedLoc: Vector3): boolean {
    const pos = player.location;
    return (
        Math.abs(pos.x - bedLoc.x) <= 1 &&
        Math.abs(pos.y - bedLoc.y) <= 1 &&
        Math.abs(pos.z - bedLoc.z) <= 1
    );
}

function tryTriggerNightmare(bedKey: string): void {
    const record = bedInteractions.get(bedKey);
    if (!record) return;

    if (!record.windowExpired || !record.scanComplete) {
        return;
    }

    bedInteractions.delete(bedKey);

    const { count, player, block, hasLight } = record;
    if (count === 1 && isNight() && isNearBed(player, block.location) && hasLight === false) {
        system.runTimeout(() => {
            if (player.isValid) {
                spawnNightmare(player, block);
            }
        }, CONFIG.SPAWN_DELAY);
    }
}

function* lightCheckGenerator(block: Block, bedKey: string): Generator<void, void, unknown> {
    const { x: bx, y: by, z: bz } = block.location;
    const dim = block.dimension;
    const yMin = by - CONFIG.Y_RANGE_DOWN;
    const yMax = by + CONFIG.Y_RANGE_UP;

    let checked = 0;

    for (let dx = -CONFIG.CHECK_RADIUS; dx <= CONFIG.CHECK_RADIUS; dx++) {
        for (let dz = -CONFIG.CHECK_RADIUS; dz <= CONFIG.CHECK_RADIUS; dz++) {
            if (!bedInteractions.has(bedKey)) return;

            if (Math.abs(dx) + Math.abs(dz) > CONFIG.CHECK_RADIUS) continue;

            for (let dy = yMin; dy <= yMax; dy++) {
                try {
                    const nearbyBlock = dim.getBlock({ x: bx + dx, y: dy, z: bz + dz });
                    if (nearbyBlock && LIGHT_SOURCES.has(nearbyBlock.typeId)) {
                        const record = bedInteractions.get(bedKey);
                        if (record) {
                            record.hasLight = true;
                            record.scanComplete = true;
                            tryTriggerNightmare(bedKey);
                        }
                        return;
                    }
                } catch {
                    // Chunk edge boundary during spatial scan
                }

                checked++;
                if (checked % 50 === 0) {
                    yield;
                }
            }
        }
    }

    const record = bedInteractions.get(bedKey);
    if (record) {
        record.hasLight = false;
        record.scanComplete = true;
        tryTriggerNightmare(bedKey);
    }
}

function getSpawnOffset(bedBlock: Block): Vector3 {
    const { x, y, z } = bedBlock.location;
    const offsets = [
        { x: x + 1, y, z },
        { x: x - 1, y, z },
        { x, y, z: z + 1 },
        { x, y, z: z - 1 }
    ];

    for (const offset of offsets) {
        try {
            const feet = bedBlock.dimension.getBlock(offset);
            const head = bedBlock.dimension.getBlock({ x: offset.x, y: offset.y + 1, z: offset.z });
            if (feet?.typeId === "minecraft:air" && head?.typeId === "minecraft:air") {
                return { x: offset.x + 0.5, y: offset.y, z: offset.z + 0.5 };
            }
        } catch {
            // Block query safety
        }
    }

    return { x: x + 0.5, y: y + 1, z: z + 0.5 };
}

function spawnNightmare(player: Player, block: Block): void {
    try {
        player.applyDamage(1);

        const mob = NIGHTMARE_MOBS[Math.floor(Math.random() * NIGHTMARE_MOBS.length)];
        const spawnLoc = getSpawnOffset(block);

        block.dimension.spawnEntity(mob, spawnLoc);
    } catch (e) {
        reportError({
            system: "nightmares",
            operation: "spawnNightmare",
            target: player.name
        }, e);
    }
}

eventBus.onPlayerInteractWithBlock((event) => {
    const { player, block } = event;
    if (!block || !block.typeId.includes("bed")) return;

    const bedKey = `${block.dimension.id}:${block.location.x},${block.location.y},${block.location.z}`;
    const current = bedInteractions.get(bedKey);

    if (!current) {
        const record: BedInteraction = {
            count: 1,
            player,
            block,
            windowExpired: false,
            scanComplete: false,
            hasLight: null
        };
        bedInteractions.set(bedKey, record);

        system.runJob(lightCheckGenerator(block, bedKey));

        system.runTimeout(() => {
            const entry = bedInteractions.get(bedKey);
            if (entry) {
                entry.windowExpired = true;
                tryTriggerNightmare(bedKey);
            }
        }, CONFIG.INTERACTION_WINDOW);
    } else {
        current.count += 1;
        bedInteractions.delete(bedKey);
    }
});

eventBus.onPlayerLeave((event) => {
    for (const [key, record] of bedInteractions) {
        if (record.player?.id === event.playerId) {
            bedInteractions.delete(key);
        }
    }
});
