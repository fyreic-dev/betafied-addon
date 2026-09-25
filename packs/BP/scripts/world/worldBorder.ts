import { world, Player, Vector3 } from "@minecraft/server";
import { eventBus } from "../core/eventBus.js";
import { tickManager } from "../core/tickManager.js";
import { reportError } from "../core/errorReporter.js";

const CONFIG = Object.freeze({
    BORDER: 2500,
    WARNING_ZONE: 2000,
    CHECK_INTERVAL: 10,
    PUSHBACK_DISTANCE: 5,
    WARNING_COOLDOWN_MS: 10000
});

const warnedPlayers = new Map<string, number>();

export function* checkPlayersGenerator(): Generator<void, void, unknown> {
    const players = world.getAllPlayers();
    for (const player of players) {
        yield;
        if (!player.isValid) continue;

        const loc = player.location;
        const absX = Math.abs(loc.x);
        const absZ = Math.abs(loc.z);
        const maxDist = Math.max(absX, absZ);

        if (maxDist >= CONFIG.BORDER) {
            handleBorderCross(player, loc);
            continue;
        }

        if (maxDist >= CONFIG.WARNING_ZONE) {
            handleWarning(player, maxDist);
        } else {
            warnedPlayers.delete(player.id);
        }
    }
}

function handleBorderCross(player: Player, loc: Vector3): void {
    try {
        const spawn = player.getSpawnPoint();

        if (spawn && spawn.dimension.id === player.dimension.id) {
            player.teleport({ x: spawn.x, y: spawn.y, z: spawn.z });
            player.sendMessage("§c[Betafied] you crossed the world border, returned to spawn");
        } else {
            const pushX = loc.x > 0
                ? CONFIG.BORDER - CONFIG.PUSHBACK_DISTANCE
                : -(CONFIG.BORDER - CONFIG.PUSHBACK_DISTANCE);
            const pushZ = loc.z > 0
                ? CONFIG.BORDER - CONFIG.PUSHBACK_DISTANCE
                : -(CONFIG.BORDER - CONFIG.PUSHBACK_DISTANCE);

            const newX = Math.abs(loc.x) >= CONFIG.BORDER ? pushX : loc.x;
            const newZ = Math.abs(loc.z) >= CONFIG.BORDER ? pushZ : loc.z;

            player.teleport({ x: newX, y: loc.y, z: newZ });
            player.sendMessage("§c[Betafied] you crossed the world border");
        }
    } catch (e) {
        reportError({
            system: "worldBorder",
            operation: "handleBorderCross",
            target: player.name
        }, e);
    }
}

function handleWarning(player: Player, dist: number): void {
    const now = Date.now();
    const lastWarn = warnedPlayers.get(player.id) ?? 0;

    if (now - lastWarn > CONFIG.WARNING_COOLDOWN_MS) {
        const distToBorder = Math.floor(CONFIG.BORDER - dist);
        player.sendMessage(`§e[Betafied] warning: ${distToBorder} blocks from world border`);
        warnedPlayers.set(player.id, now);
    }
}

tickManager.register("worldBorder", CONFIG.CHECK_INTERVAL, checkPlayersGenerator, 4);

eventBus.onPlayerLeave((ev) => {
    warnedPlayers.delete(ev.playerId);
});
