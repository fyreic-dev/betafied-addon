import {
    world,
    system,
    PlayerInteractWithBlockBeforeEvent,
    Direction,
    StructureRotation,
    EntityComponentTypes,
    EquipmentSlot,
    Player,
    GameMode,
    ItemComponentUseOnEvent,
    BlockPermutation
} from "@minecraft/server";
import { eventBus } from "../core/eventBus.js";
import { reportError, runCatching } from "../core/errorReporter.js";

/**
 * Maps player horizontal view direction to authentic StructureRotation.
 * oak_stairs.mcstructure is stored with default East orientation (weirdo_direction: 0).
 */
export function getStairStructureRotation(viewDir: { x: number; y: number; z: number }): StructureRotation {
    if (Math.abs(viewDir.x) > Math.abs(viewDir.z)) {
        return viewDir.x > 0 ? StructureRotation.None : StructureRotation.Rotate180;
    } else {
        return viewDir.z > 0 ? StructureRotation.Rotate90 : StructureRotation.Rotate270;
    }
}

/**
 * Calculates adjacent placement location from clicked block and face.
 */
export function getPlacementLocation(
    blockLoc: { x: number; y: number; z: number },
    face: Direction
): { x: number; y: number; z: number } {
    const target = { x: Math.floor(blockLoc.x), y: Math.floor(blockLoc.y), z: Math.floor(blockLoc.z) };
    switch (face) {
        case Direction.Up: target.y += 1; break;
        case Direction.Down: target.y -= 1; break;
        case Direction.North: target.z -= 1; break;
        case Direction.South: target.z += 1; break;
        case Direction.West: target.x -= 1; break;
        case Direction.East: target.x += 1; break;
    }
    return target;
}

export function isReplaceableBlock(blockTypeId: string): boolean {
    return blockTypeId === "minecraft:air" ||
           blockTypeId === "minecraft:structure_void" ||
           blockTypeId === "minecraft:short_grass" ||
           blockTypeId === "minecraft:fern" ||
           blockTypeId === "minecraft:dead_bush" ||
           blockTypeId === "minecraft:snow_layer" ||
           blockTypeId.includes("water") ||
           blockTypeId.includes("lava");
}

/**
 * Triggers arm swing animation on the player entity.
 */
export function playArmSwing(player: Player): void {
    if (typeof player.playAnimation === "function") {
        runCatching({ system: "structurePlacer", operation: "playAnimation.place_swing", target: player.name }, () => {
            player.playAnimation("animation.player.place_swing", { blendOutTime: 0.05, controller: "arm_swing" });
        });
    }
}

export function consumeHeldItem(player: Player, itemTypeId: string): void {
    const isCreative = typeof player.getGameMode === "function" && player.getGameMode() === GameMode.Creative;
    if (isCreative) return;

    const equippable = player.getComponent(EntityComponentTypes.Equippable);
    if (!equippable) return;

    const mainhand = equippable.getEquipment(EquipmentSlot.Mainhand);
    if (mainhand && mainhand.typeId === itemTypeId) {
        if (mainhand.amount > 1) {
            mainhand.amount -= 1;
            equippable.setEquipment(EquipmentSlot.Mainhand, mainhand);
        } else {
            equippable.setEquipment(EquipmentSlot.Mainhand, undefined);
        }
    }
}

let lastPlacementTick = -1;
let lastPlacementPlayerId = "";

export function executeStairPlacement(
    player: Player,
    block: { typeId: string; location: { x: number; y: number; z: number } },
    blockFace: Direction
): void {
    if (!block || !player || !player.isValid) return;

    if (system.currentTick === lastPlacementTick && player.id === lastPlacementPlayerId) {
        return;
    }
    lastPlacementTick = system.currentTick;
    lastPlacementPlayerId = player.id;

    const dim = player.dimension;
    const targetLoc = isReplaceableBlock(block.typeId)
        ? { x: Math.floor(block.location.x), y: Math.floor(block.location.y), z: Math.floor(block.location.z) }
        : getPlacementLocation(block.location, blockFace);

    const rotation = getStairStructureRotation(player.getViewDirection());

    system.run(() => {
        try {
            const currentAtTarget = dim.getBlock(targetLoc);
            if (!currentAtTarget || (!isReplaceableBlock(currentAtTarget.typeId) && currentAtTarget.typeId !== "minecraft:air")) {
                return;
            }

            world.structureManager.place("mystructure:oak_stairs", dim, targetLoc, {
                rotation,
                includeBlocks: true,
                includeEntities: false
            });

            dim.playSound("use.wood", targetLoc, { pitch: 0.8, volume: 1.0 });
            playArmSwing(player);
            consumeHeldItem(player, "bh:oak_stairs");
        } catch (e) {
            reportError({
                system: "structurePlacer",
                operation: "placeStairStructure",
                target: player.name
            }, e);
        }
    });
}

export function executeLogPlacement(
    player: Player,
    block: { typeId: string; location: { x: number; y: number; z: number } },
    blockFace: Direction,
    itemTypeId: string,
    logBlockId: string
): void {
    if (!block || !player || !player.isValid) return;

    if (system.currentTick === lastPlacementTick && player.id === lastPlacementPlayerId) {
        return;
    }
    lastPlacementTick = system.currentTick;
    lastPlacementPlayerId = player.id;

    const dim = player.dimension;
    const targetLoc = isReplaceableBlock(block.typeId)
        ? { x: Math.floor(block.location.x), y: Math.floor(block.location.y), z: Math.floor(block.location.z) }
        : getPlacementLocation(block.location, blockFace);

    system.run(() => {
        try {
            const currentAtTarget = dim.getBlock(targetLoc);
            if (!currentAtTarget || (!isReplaceableBlock(currentAtTarget.typeId) && currentAtTarget.typeId !== "minecraft:air")) {
                return;
            }

            const permutation = BlockPermutation.resolve(logBlockId, {
                "pillar_axis": "y"
            });
            currentAtTarget.setPermutation(permutation);

            dim.playSound("use.wood", targetLoc, { pitch: 0.8, volume: 1.0 });
            playArmSwing(player);
            consumeHeldItem(player, itemTypeId);
        } catch (e) {
            reportError({
                system: "structurePlacer",
                operation: "placeLogBlock",
                target: player.name
            }, e);
        }
    });
}

export interface SlabConfig {
    singleBlockId: string;
    doubleBlockId: string;
    soundId: string;
}

export function executeSlabPlacement(
    player: Player,
    block: { typeId: string; location: { x: number; y: number; z: number } },
    blockFace: Direction,
    itemTypeId: string,
    config: SlabConfig
): void {
    if (!block || !player || !player.isValid) return;

    if (system.currentTick === lastPlacementTick && player.id === lastPlacementPlayerId) {
        return;
    }
    lastPlacementTick = system.currentTick;
    lastPlacementPlayerId = player.id;

    const dim = player.dimension;

    if (block.typeId === config.singleBlockId && blockFace === Direction.Up) {
        system.run(() => {
            try {
                const clickedBlock = dim.getBlock(block.location);
                if (clickedBlock && clickedBlock.typeId === config.singleBlockId) {
                    const doublePerm = BlockPermutation.resolve(config.doubleBlockId);
                    clickedBlock.setPermutation(doublePerm);

                    dim.playSound(config.soundId, block.location, { pitch: 0.8, volume: 1.0 });
                    playArmSwing(player);
                    consumeHeldItem(player, itemTypeId);
                }
            } catch (e) {
                reportError({
                    system: "structurePlacer",
                    operation: "placeDoubleSlabStack",
                    target: player.name
                }, e);
            }
        });
        return;
    }

    const targetLoc = isReplaceableBlock(block.typeId)
        ? { x: Math.floor(block.location.x), y: Math.floor(block.location.y), z: Math.floor(block.location.z) }
        : getPlacementLocation(block.location, blockFace);

    system.run(() => {
        try {
            const currentAtTarget = dim.getBlock(targetLoc);
            if (!currentAtTarget) return;

            if (currentAtTarget.typeId === config.singleBlockId) {
                const doublePerm = BlockPermutation.resolve(config.doubleBlockId);
                currentAtTarget.setPermutation(doublePerm);

                dim.playSound(config.soundId, targetLoc, { pitch: 0.8, volume: 1.0 });
                playArmSwing(player);
                consumeHeldItem(player, itemTypeId);
                return;
            }

            if (!isReplaceableBlock(currentAtTarget.typeId) && currentAtTarget.typeId !== "minecraft:air") {
                return;
            }

            const singlePerm = config.singleBlockId === "bh:wooden_slab"
                ? BlockPermutation.resolve("bh:wooden_slab", { "bh:upper": false })
                : BlockPermutation.resolve(config.singleBlockId, { "minecraft:vertical_half": "bottom" });

            currentAtTarget.setPermutation(singlePerm);

            dim.playSound(config.soundId, targetLoc, { pitch: 0.8, volume: 1.0 });
            playArmSwing(player);
            consumeHeldItem(player, itemTypeId);
        } catch (e) {
            reportError({
                system: "structurePlacer",
                operation: "placeSingleSlab",
                target: player.name
            }, e);
        }
    });
}

export const LOG_BLOCK_MAP: Readonly<Record<string, string>> = Object.freeze({
    "bh:oak_log": "minecraft:oak_log",
    "bh:birch_log": "minecraft:birch_log",
    "bh:spruce_log": "minecraft:spruce_log"
});

export const SLAB_CONFIG_MAP: Readonly<Record<string, SlabConfig>> = Object.freeze({
    "bh:cobblestone_slab": {
        singleBlockId: "minecraft:cobblestone_slab",
        doubleBlockId: "minecraft:cobblestone_double_slab",
        soundId: "use.stone"
    },
    "bh:sandstone_slab": {
        singleBlockId: "minecraft:sandstone_slab",
        doubleBlockId: "minecraft:sandstone_double_slab",
        soundId: "use.stone"
    },
    "bh:stone_slab": {
        singleBlockId: "minecraft:smooth_stone_slab",
        doubleBlockId: "minecraft:smooth_stone_double_slab",
        soundId: "use.stone"
    },
    "bh:wooden_slab": {
        singleBlockId: "bh:wooden_slab",
        doubleBlockId: "minecraft:oak_double_slab",
        soundId: "use.wood"
    }
});

export function handleStairItemPlacement(event: PlayerInteractWithBlockBeforeEvent): void {
    const { itemStack, block, blockFace, player } = event;
    if (!itemStack || !block || !player || !player.isValid) return;

    const itemId = itemStack.typeId;

    if (itemId === "bh:oak_stairs") {
        event.cancel = true;
        executeStairPlacement(player, block, blockFace);
        return;
    }

    const logBlockId = LOG_BLOCK_MAP[itemId];
    if (logBlockId) {
        event.cancel = true;
        executeLogPlacement(player, block, blockFace, itemId, logBlockId);
        return;
    }

    const slabConfig = SLAB_CONFIG_MAP[itemId];
    if (slabConfig) {
        event.cancel = true;
        executeSlabPlacement(player, block, blockFace, itemId, slabConfig);
        return;
    }
}

eventBus.onPlayerInteractWithBlock(handleStairItemPlacement);

if (system.beforeEvents?.startup) {
    system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
        itemComponentRegistry.registerCustomComponent("bh:stair_placer", {
            onUseOn(event: ItemComponentUseOnEvent) {
                const player = event.source;
                if (!(player instanceof Player) || !player.isValid) return;
                executeStairPlacement(player, event.block, event.blockFace);
            }
        });
    });
}
