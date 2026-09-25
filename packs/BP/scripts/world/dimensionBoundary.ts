import { world } from "@minecraft/server";
import { eventBus } from "../core/eventBus.js";

eventBus.onPlayerDimensionChange((event) => {
    if (event.toDimension.id === "minecraft:the_end") {
        const player = event.player;
        if (player.isValid) {
            const overworld = world.getDimension("overworld");
            const spawn = player.getSpawnPoint();
            const targetLoc = spawn && spawn.dimension.id === "minecraft:overworld"
                ? { x: spawn.x, y: spawn.y, z: spawn.z }
                : { x: 0, y: 70, z: 0 };
            player.teleport(targetLoc, { dimension: overworld });
            player.sendMessage("§cThe End does not exist in Beta 1.7.3.");
        }
    }
});
