import { Direction } from "@minecraft/server";
import { eventBus } from "../core/eventBus.js";

eventBus.onPlayerInteractWithBlock((event) => {
    try {
        const { player, block, blockFace } = event;
        let targetY = block.location.y;
        if (blockFace === Direction.Up) {
            targetY++;
        }
        if (targetY >= 128) {
            event.cancel = true;
            player.sendMessage("§cHeight limit for building is 128 blocks");
        }
    } catch {
        // Boundary safety
    }
});

eventBus.onPlayerPlaceBlock((event) => {
    try {
        const { player, block } = event;
        if (block.location.y >= 128) {
            block.setType("minecraft:air");
            player.sendMessage("§cHeight limit for building is 128 blocks");
        }
    } catch {
        // Boundary safety
    }
});
