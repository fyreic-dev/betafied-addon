import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Direction, StructureRotation, system, world } from "@minecraft/server";
import {
    getStairStructureRotation,
    getPlacementLocation,
    isReplaceableBlock,
    handleStairItemPlacement,
    playArmSwing
} from "../../packs/BP/scripts/interactions/structurePlacer.js";

describe("Structure Placer Prototype - 3D Item & Structure Rotation", () => {
    it("correctly maps player view direction to StructureRotation", () => {
        // Facing East (+X)
        assert.equal(
            getStairStructureRotation({ x: 1, y: 0, z: 0 }),
            StructureRotation.None,
            "Facing East should map to StructureRotation.None"
        );

        // Facing West (-X)
        assert.equal(
            getStairStructureRotation({ x: -1, y: 0, z: 0 }),
            StructureRotation.Rotate180,
            "Facing West should map to StructureRotation.Rotate180"
        );

        // Facing South (+Z)
        assert.equal(
            getStairStructureRotation({ x: 0, y: 0, z: 1 }),
            StructureRotation.Rotate90,
            "Facing South should map to StructureRotation.Rotate90"
        );

        // Facing North (-Z)
        assert.equal(
            getStairStructureRotation({ x: 0, y: 0, z: -1 }),
            StructureRotation.Rotate270,
            "Facing North should map to StructureRotation.Rotate270"
        );
    });

    it("calculates adjacent target placement coordinates based on clicked block face", () => {
        const base = { x: 10, y: 64, z: 10 };

        assert.deepEqual(getPlacementLocation(base, Direction.Up), { x: 10, y: 65, z: 10 });
        assert.deepEqual(getPlacementLocation(base, Direction.Down), { x: 10, y: 63, z: 10 });
        assert.deepEqual(getPlacementLocation(base, Direction.North), { x: 10, y: 64, z: 9 });
        assert.deepEqual(getPlacementLocation(base, Direction.South), { x: 10, y: 64, z: 11 });
        assert.deepEqual(getPlacementLocation(base, Direction.West), { x: 9, y: 64, z: 10 });
        assert.deepEqual(getPlacementLocation(base, Direction.East), { x: 11, y: 64, z: 10 });
    });

    it("identifies replaceable blocks", () => {
        assert.equal(isReplaceableBlock("minecraft:air"), true);
        assert.equal(isReplaceableBlock("minecraft:short_grass"), true);
        assert.equal(isReplaceableBlock("minecraft:water"), true);
        assert.equal(isReplaceableBlock("minecraft:stone"), false);
        assert.equal(isReplaceableBlock("minecraft:oak_planks"), false);
    });

    it("cancels native interaction and places rotated structure natively when bh:oak_stairs is used", () => {
        const fakePlayer = {
            isValid: true,
            name: "Steve",
            animationsPlayed: [] as string[],
            getViewDirection() {
                return { x: 0, y: 0, z: 1 }; // Facing South -> Rotate90
            },
            playAnimation(name: string) {
                this.animationsPlayed.push(name);
            },
            dimension: {
                soundsPlayed: [] as { soundId: string; location: any }[],
                getBlock(_loc: any) {
                    return { typeId: "minecraft:air" };
                },
                playSound(soundId: string, location: any) {
                    this.soundsPlayed.push({ soundId, location });
                },
                runCommand(_cmd: string) {
                    return { successCount: 1 };
                }
            },
            getComponent() {
                return null;
            }
        };

        const fakeEvent = {
            itemStack: { typeId: "bh:oak_stairs", amount: 1 },
            block: {
                typeId: "minecraft:stone",
                location: { x: 20, y: 64, z: 20 }
            },
            blockFace: Direction.Up,
            player: fakePlayer,
            cancel: false
        };

        handleStairItemPlacement(fakeEvent as any);

        assert.equal(fakeEvent.cancel, true, "Event must be cancelled to prevent native upside-down placement");

        // Execute scheduled runner
        const timeouts = (system as any).scheduledTimeouts;
        if (timeouts && timeouts.length > 0) {
            for (const t of [...timeouts]) {
                t.callback();
            }
        }

        // Verify native structure placement via world.structureManager.place
        const placed = (world as any).structureManager.placedStructures;
        assert.ok(placed.length > 0, "A structure was placed natively via world.structureManager");
        assert.equal(placed[placed.length - 1].structure, "mystructure:oak_stairs");
        assert.equal(placed[placed.length - 1].options.rotation, StructureRotation.Rotate90);

        // Verify native sound played via dim.playSound
        assert.ok(fakePlayer.dimension.soundsPlayed.length > 0, "Placement sound was played natively");
        assert.equal(fakePlayer.dimension.soundsPlayed[0].soundId, "use.wood");

        // Verify native animation played via player.playAnimation
        assert.ok(fakePlayer.animationsPlayed.includes("animation.player.place_swing"));
    });

    it("triggers arm swing animation on the player", () => {
        const animations: string[] = [];
        const mockPlayer = {
            isValid: true,
            playAnimation(name: string) {
                animations.push(name);
            }
        };

        playArmSwing(mockPlayer as any);

        assert.ok(
            animations.includes("animation.player.place_swing"),
            "Expected animation.player.place_swing to be played"
        );
    });

    it("cancels native placement and sets vertical pillar permutation for bh: logs", () => {
        let placedPerm: any = null;
        const fakePlayer = {
            id: "steve_log",
            isValid: true,
            name: "Steve",
            animationsPlayed: [] as string[],
            getViewDirection() { return { x: 0, y: 0, z: 1 }; },
            playAnimation(name: string) { this.animationsPlayed.push(name); },
            dimension: {
                soundsPlayed: [] as { soundId: string; location: any }[],
                getBlock(_loc: any) {
                    return {
                        typeId: "minecraft:air",
                        setPermutation(perm: any) { placedPerm = perm; }
                    };
                },
                playSound(soundId: string, location: any) {
                    this.soundsPlayed.push({ soundId, location });
                }
            },
            getComponent() { return null; }
        };

        const fakeEvent = {
            itemStack: { typeId: "bh:oak_log", amount: 1 },
            block: {
                typeId: "minecraft:grass_block",
                location: { x: 10, y: 64, z: 10 }
            },
            blockFace: Direction.Up,
            player: fakePlayer,
            cancel: false
        };

        handleStairItemPlacement(fakeEvent as any);
        assert.equal(fakeEvent.cancel, true);

        const timeouts = (system as any).scheduledTimeouts;
        if (timeouts && timeouts.length > 0) {
            for (const t of [...timeouts]) { t.callback(); }
        }

        assert.ok(placedPerm, "Log permutation must be placed");
        assert.equal(placedPerm.typeId, "minecraft:oak_log");
        assert.equal(placedPerm.getState("pillar_axis"), "y");
        assert.equal(fakePlayer.dimension.soundsPlayed[0].soundId, "use.wood");
    });

    it("cancels native placement and places bottom-only slab for bh: slabs", () => {
        let placedPerm: any = null;
        const fakePlayer = {
            id: "steve_slab",
            isValid: true,
            name: "Steve",
            animationsPlayed: [] as string[],
            getViewDirection() { return { x: 0, y: 0, z: 1 }; },
            playAnimation(name: string) { this.animationsPlayed.push(name); },
            dimension: {
                soundsPlayed: [] as { soundId: string; location: any }[],
                getBlock(_loc: any) {
                    return {
                        typeId: "minecraft:air",
                        setPermutation(perm: any) { placedPerm = perm; }
                    };
                },
                playSound(soundId: string, location: any) {
                    this.soundsPlayed.push({ soundId, location });
                }
            },
            getComponent() { return null; }
        };

        const fakeEvent = {
            itemStack: { typeId: "bh:cobblestone_slab", amount: 1 },
            block: {
                typeId: "minecraft:stone",
                location: { x: 10, y: 64, z: 10 }
            },
            blockFace: Direction.Up,
            player: fakePlayer,
            cancel: false
        };

        handleStairItemPlacement(fakeEvent as any);
        assert.equal(fakeEvent.cancel, true);

        const timeouts = (system as any).scheduledTimeouts;
        if (timeouts && timeouts.length > 0) {
            for (const t of [...timeouts]) { t.callback(); }
        }

        assert.ok(placedPerm, "Slab permutation must be placed");
        assert.equal(placedPerm.typeId, "minecraft:cobblestone_slab");
        assert.equal(placedPerm.getState("minecraft:vertical_half"), "bottom");
        assert.equal(fakePlayer.dimension.soundsPlayed[0].soundId, "use.stone");
    });

    it("stacks matching slab into double slab when clicking top face of bottom slab", () => {
        let stackedPerm: any = null;
        const clickedSlab = {
            typeId: "minecraft:cobblestone_slab",
            location: { x: 10, y: 64, z: 10 },
            setPermutation(perm: any) { stackedPerm = perm; }
        };

        const fakePlayer = {
            id: "steve_double_slab",
            isValid: true,
            name: "Steve",
            animationsPlayed: [] as string[],
            getViewDirection() { return { x: 0, y: 0, z: 1 }; },
            playAnimation(name: string) { this.animationsPlayed.push(name); },
            dimension: {
                soundsPlayed: [] as { soundId: string; location: any }[],
                getBlock(_loc: any) { return clickedSlab; },
                playSound(soundId: string, location: any) {
                    this.soundsPlayed.push({ soundId, location });
                }
            },
            getComponent() { return null; }
        };

        const fakeEvent = {
            itemStack: { typeId: "bh:cobblestone_slab", amount: 1 },
            block: clickedSlab,
            blockFace: Direction.Up,
            player: fakePlayer,
            cancel: false
        };

        handleStairItemPlacement(fakeEvent as any);
        assert.equal(fakeEvent.cancel, true);

        const timeouts = (system as any).scheduledTimeouts;
        if (timeouts && timeouts.length > 0) {
            for (const t of [...timeouts]) { t.callback(); }
        }

        assert.ok(stackedPerm, "Double slab permutation must be placed");
        assert.equal(stackedPerm.typeId, "minecraft:cobblestone_double_slab");
        assert.equal(fakePlayer.dimension.soundsPlayed[0].soundId, "use.stone");
    });
});
