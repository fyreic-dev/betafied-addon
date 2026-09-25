import { world, Player, EquipmentSlot, EntityComponentTypes } from "@minecraft/server";
import { eventBus } from "../core/eventBus.js";
import { tickManager } from "../core/tickManager.js";
import { runCatching } from "../core/errorReporter.js";

export const SLOW_BLOCKS = new Set([
    "minecraft:redstone_ore",
    "minecraft:lit_redstone_ore"
]);

export const PICKAXES = new Set([
    "minecraft:wooden_pickaxe",
    "minecraft:stone_pickaxe",
    "minecraft:iron_pickaxe",
    "minecraft:golden_pickaxe",
    "minecraft:diamond_pickaxe"
]);

const CONFIG = Object.freeze({
    TICK_INTERVAL: 3,
    FATIGUE_DURATION: 10,
    FATIGUE_AMPLIFIER: 1,
    MAX_DISTANCE: 5
});

const hasFatigue = new Set<string>();

export function clearFatigue(player: Player): void {
    if (hasFatigue.has(player.id)) {
        try {
            player.removeEffect("mining_fatigue");
        } catch {
            // Player may have unloaded or disconnected
        }
        hasFatigue.delete(player.id);
    }
}

tickManager.register("redstoneMining", CONFIG.TICK_INTERVAL, () => {
    for (const player of world.getAllPlayers()) {
        if (!player.isValid) continue;

        runCatching({ system: "redstoneMining", operation: "checkPlayer" }, () => {
            const equip = player.getComponent(EntityComponentTypes.Equippable);
            const mainhand = equip?.getEquipment(EquipmentSlot.Mainhand);
            const hasPick = mainhand && PICKAXES.has(mainhand.typeId);

            if (!hasPick) {
                clearFatigue(player);
                return;
            }

            const blockRay = player.getBlockFromViewDirection({ maxDistance: CONFIG.MAX_DISTANCE });
            
            if (blockRay?.block && SLOW_BLOCKS.has(blockRay.block.typeId)) {
                player.addEffect("mining_fatigue", CONFIG.FATIGUE_DURATION, {
                    amplifier: CONFIG.FATIGUE_AMPLIFIER,
                    showParticles: false
                });
                hasFatigue.add(player.id);
            } else {
                clearFatigue(player);
            }
        });
    }
});

eventBus.onPlayerLeave((ev) => {
    hasFatigue.delete(ev.playerId);
});
