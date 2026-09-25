import { world, EquipmentSlot, EntityComponentTypes } from "@minecraft/server";
import { tickManager } from "../core/tickManager.js";
import { reportError } from "../core/errorReporter.js";

export function playerStateJob(): void {
    const players = world.getAllPlayers();

    for (const player of players) {
        if (!player.isValid) continue;

        try {
            if (player.level > 0 || player.xpEarnedAtCurrentLevel > 0) {
                player.resetLevel();
            }

            const equippable = player.getComponent(EntityComponentTypes.Equippable);
            if (!equippable) continue;

            const offhandItem = equippable.getEquipment(EquipmentSlot.Offhand);

            if (offhandItem) {
                equippable.setEquipment(EquipmentSlot.Offhand, undefined);

                const invComp = player.getComponent(EntityComponentTypes.Inventory);
                const inv = invComp?.container;
                if (inv) {
                    const leftover = inv.addItem(offhandItem);
                    if (leftover) {
                        player.dimension.spawnItem(leftover, player.location);
                    }
                } else {
                    player.dimension.spawnItem(offhandItem, player.location);
                }
            }
        } catch (e) {
            reportError({
                system: "playerState",
                operation: "processPlayerState",
                target: player.name
            }, e);
        }
    }
}

tickManager.register("playerState", 2, playerStateJob, 1);
