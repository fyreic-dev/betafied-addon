import { world, Player } from "@minecraft/server";
import { tickManager } from "../core/tickManager.js";

const RUINED_PORTAL_BLOCKS = Object.freeze(new Set([
    "minecraft:crying_obsidian",
    "minecraft:magma"
]));

function* scanAroundPlayer(player: Player): Generator<void, void, unknown> {
    const dim = player.dimension;
    const px = Math.floor(player.location.x);
    const py = Math.floor(player.location.y);
    const pz = Math.floor(player.location.z);

    const RADIUS = 16;
    const Y_RANGE = 16;

    for (let dx = -RADIUS; dx <= RADIUS; dx += 4) {
        for (let dz = -RADIUS; dz <= RADIUS; dz += 4) {
            for (let dy = -Y_RANGE; dy <= Y_RANGE; dy += 4) {
                try {
                    const block = dim.getBlock({
                        x: px + dx,
                        y: py + dy,
                        z: pz + dz
                    });

                    if (block && RUINED_PORTAL_BLOCKS.has(block.typeId)) {
                        block.setType(py + dy < 0 ? "minecraft:stone" : "minecraft:air");
                    }
                } catch {
                    // Block query safety during spatial scan
                }
            }
            yield;
        }
    }
}

export function* portalScanJob(): Generator<void, void, unknown> {
    for (const player of world.getAllPlayers()) {
        yield* scanAroundPlayer(player);
    }
}

tickManager.register("ruinedPortalScrubber", 300, portalScanJob, 100);
