import { ItemStack, EntityComponentTypes } from "@minecraft/server";
import { reportError } from "../core/errorReporter.js";
import { isBetaEntity } from "../core/betaRegistry.js";
import { normalizeEntityDrop } from "../core/normalizer.js";
import { eventBus } from "../core/eventBus.js";

eventBus.onEntitySpawn((event) => {
    try {
        const entity = event.entity;
        if (!entity || !entity.isValid) return;

        const typeId = entity.typeId;

        if (typeId === "minecraft:item") {
            const itemComp = entity.getComponent(EntityComponentTypes.Item);
            if (!itemComp?.itemStack) return;

            const itemId = itemComp.itemStack.typeId;
            const amount = itemComp.itemStack.amount;

            const dropResult = normalizeEntityDrop(itemId);
            if (dropResult.action === "remove") {
                entity.remove();
                return;
            }

            if (dropResult.action === "convert" && dropResult.targetId) {
                const loc = entity.location;
                const dim = entity.dimension;
                entity.remove();
                dim.spawnItem(new ItemStack(dropResult.targetId, amount), loc);
                return;
            }

            return;
        }

        if (!isBetaEntity(typeId)) {
            entity.remove();
        }

    } catch (e) {
        reportError({
            system: "entitySpawnHandler",
            operation: "entitySpawnValidation",
            target: event.entity?.typeId
        }, e);
    }
});

eventBus.onEntityDie((event) => {
    try {
        const deadEntity = event.deadEntity;
        if (!deadEntity) return;

        const type = deadEntity.typeId;

        // In Beta 1.7.3, zombies dropped feathers instead of rotten flesh
        if (type === "minecraft:zombie" || type === "minecraft:zombie_villager" || type === "minecraft:husk") {
            const count = Math.floor(Math.random() * 3);
            if (count > 0) {
                deadEntity.dimension.spawnItem(new ItemStack("minecraft:feather", count), deadEntity.location);
            }
        }
    } catch (e) {
        reportError({
            system: "entitySpawnHandler",
            operation: "featherDrop",
            target: event.deadEntity?.typeId
        }, e);
    }
});
