import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Direction, StructureRotation, system, world } from "@minecraft/server";
import { registeredCustomComponents, Player } from "../mocks/minecraftServer.js";
import {
    getStairStructureRotation,
    getPlacementLocation,
    isReplaceableBlock,
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

    it("places rotated structure natively via bh:stair_placer when bh:oak_stairs is used", () => {
        const stairPlacer = registeredCustomComponents.get("bh:stair_placer");
        assert.ok(stairPlacer && typeof stairPlacer.onUseOn === "function");

        const fakePlayer = Object.assign(new Player("steve_oak_stairs", "Steve"), {
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
            }
        });

        stairPlacer.onUseOn({
            source: fakePlayer,
            itemStack: { typeId: "bh:oak_stairs", amount: 1 },
            block: {
                typeId: "minecraft:stone",
                location: { x: 20, y: 64, z: 20 }
            },
            blockFace: Direction.Up
        });

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

    it("places mystructure:cobblestone_stairs with use.stone sound for bh:cobblestone_stairs via bh:stair_placer", () => {
        const stairPlacer = registeredCustomComponents.get("bh:stair_placer");
        assert.ok(stairPlacer && typeof stairPlacer.onUseOn === "function");

        const fakePlayer = Object.assign(new Player("steve_cobble_stairs", "Steve"), {
            getViewDirection: () => ({ x: 0, y: 0, z: 1 }),
            animationsPlayed: [] as string[],
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
            }
        });

        stairPlacer.onUseOn({
            source: fakePlayer,
            itemStack: { typeId: "bh:cobblestone_stairs", amount: 1 },
            block: {
                typeId: "minecraft:stone",
                location: { x: 30, y: 64, z: 30 }
            },
            blockFace: Direction.Up
        });

        const timeouts = (system as any).scheduledTimeouts;
        if (timeouts && timeouts.length > 0) {
            for (const t of [...timeouts]) {
                t.callback();
            }
        }

        const placed = (world as any).structureManager.placedStructures;
        assert.ok(placed.length > 0, "A structure was placed natively via world.structureManager");
        assert.equal(placed[placed.length - 1].structure, "mystructure:cobblestone_stairs");
        assert.equal(placed[placed.length - 1].options.rotation, StructureRotation.Rotate90);

        assert.ok(fakePlayer.dimension.soundsPlayed.length > 0, "Placement sound was played natively");
        assert.equal(fakePlayer.dimension.soundsPlayed[0].soundId, "use.stone");
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

    it("sets vertical pillar permutation for bh: logs via bh:log_placer", () => {
        const logPlacer = registeredCustomComponents.get("bh:log_placer");
        assert.ok(logPlacer && typeof logPlacer.onUseOn === "function");

        let placedPerm: any = null;
        const fakePlayer = Object.assign(new Player("steve_log", "Steve"), {
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
            }
        });

        logPlacer.onUseOn({
            source: fakePlayer,
            itemStack: { typeId: "bh:oak_log", amount: 1 },
            block: {
                typeId: "minecraft:grass_block",
                location: { x: 10, y: 64, z: 10 }
            },
            blockFace: Direction.Up
        });

        const timeouts = (system as any).scheduledTimeouts;
        if (timeouts && timeouts.length > 0) {
            for (const t of [...timeouts]) { t.callback(); }
        }

        assert.ok(placedPerm, "Log permutation must be placed");
        assert.equal(placedPerm.typeId, "minecraft:oak_log");
        assert.equal(placedPerm.getState("pillar_axis"), "y");
        assert.equal(fakePlayer.dimension.soundsPlayed[0].soundId, "use.wood");
    });

    it("places bottom-only slab for bh: slabs via bh:slab_placer", () => {
        const slabPlacer = registeredCustomComponents.get("bh:slab_placer");
        assert.ok(slabPlacer && typeof slabPlacer.onUseOn === "function");

        let placedPerm: any = null;
        const fakePlayer = Object.assign(new Player("steve_slab", "Steve"), {
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
            }
        });

        slabPlacer.onUseOn({
            source: fakePlayer,
            itemStack: { typeId: "bh:cobblestone_slab", amount: 1 },
            block: {
                typeId: "minecraft:stone",
                location: { x: 10, y: 64, z: 10 }
            },
            blockFace: Direction.Up
        });

        const timeouts = (system as any).scheduledTimeouts;
        if (timeouts && timeouts.length > 0) {
            for (const t of [...timeouts]) { t.callback(); }
        }

        assert.ok(placedPerm, "Slab permutation must be placed");
        assert.equal(placedPerm.typeId, "minecraft:cobblestone_slab");
        assert.equal(placedPerm.getState("minecraft:vertical_half"), "bottom");
        assert.equal(fakePlayer.dimension.soundsPlayed[0].soundId, "use.stone");
    });

    it("places bottom-only authentic wooden slab for bh:wooden_slab via bh:slab_placer", () => {
        const slabPlacer = registeredCustomComponents.get("bh:slab_placer");
        assert.ok(slabPlacer && typeof slabPlacer.onUseOn === "function");

        let placedPerm: any = null;
        const fakePlayer = Object.assign(new Player("steve_wood_slab", "Steve"), {
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
            }
        });

        slabPlacer.onUseOn({
            source: fakePlayer,
            itemStack: { typeId: "bh:wooden_slab", amount: 1 },
            block: {
                typeId: "minecraft:stone",
                location: { x: 12, y: 64, z: 12 }
            },
            blockFace: Direction.Up
        });

        const timeouts = (system as any).scheduledTimeouts;
        if (timeouts && timeouts.length > 0) {
            for (const t of [...timeouts]) { t.callback(); }
        }

        assert.ok(placedPerm, "Wooden slab permutation must be placed");
        assert.equal(placedPerm.typeId, "bh:wooden_slab");
        assert.equal(placedPerm.getState("bh:upper"), false);
        assert.equal(fakePlayer.dimension.soundsPlayed[0].soundId, "use.wood");
    });

    it("places bottom-only sandstone and stone slabs via bh:slab_placer", () => {
        const slabPlacer = registeredCustomComponents.get("bh:slab_placer");
        assert.ok(slabPlacer && typeof slabPlacer.onUseOn === "function");

        const slabItems = [
            { id: "bh:sandstone_slab", block: "minecraft:sandstone_slab" },
            { id: "bh:stone_slab", block: "minecraft:smooth_stone_slab" }
        ];

        for (const { id, block } of slabItems) {
            let placedPerm: any = null;
            const fakePlayer = Object.assign(new Player(`steve_${id}`, "Steve"), {
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
                }
            });

            slabPlacer.onUseOn({
                source: fakePlayer,
                itemStack: { typeId: id, amount: 1 },
                block: {
                    typeId: "minecraft:stone",
                    location: { x: 15, y: 64, z: 15 }
                },
                blockFace: Direction.Up
            });

            const timeouts = (system as any).scheduledTimeouts;
            if (timeouts && timeouts.length > 0) {
                for (const t of [...timeouts]) { t.callback(); }
            }

            assert.ok(placedPerm, `Slab permutation must be placed for ${id}`);
            assert.equal(placedPerm.typeId, block);
            assert.equal(placedPerm.getState("minecraft:vertical_half"), "bottom");
            assert.equal(fakePlayer.dimension.soundsPlayed[0].soundId, "use.stone");
        }
    });

    it("stacks matching slab into double slab when clicking top face of bottom slab via bh:slab_placer", () => {
        const slabPlacer = registeredCustomComponents.get("bh:slab_placer");
        assert.ok(slabPlacer && typeof slabPlacer.onUseOn === "function");

        let stackedPerm: any = null;
        const clickedSlab = {
            typeId: "minecraft:cobblestone_slab",
            location: { x: 10, y: 64, z: 10 },
            setPermutation(perm: any) { stackedPerm = perm; }
        };

        const fakePlayer = Object.assign(new Player("steve_double_slab", "Steve"), {
            animationsPlayed: [] as string[],
            getViewDirection() { return { x: 0, y: 0, z: 1 }; },
            playAnimation(name: string) { this.animationsPlayed.push(name); },
            dimension: {
                soundsPlayed: [] as { soundId: string; location: any }[],
                getBlock(_loc: any) { return clickedSlab; },
                playSound(soundId: string, location: any) {
                    this.soundsPlayed.push({ soundId, location });
                }
            }
        });

        slabPlacer.onUseOn({
            source: fakePlayer,
            itemStack: { typeId: "bh:cobblestone_slab", amount: 1 },
            block: clickedSlab,
            blockFace: Direction.Up
        });

        const timeouts = (system as any).scheduledTimeouts;
        if (timeouts && timeouts.length > 0) {
            for (const t of [...timeouts]) { t.callback(); }
        }

        assert.ok(stackedPerm, "Double slab permutation must be placed");
        assert.equal(stackedPerm.typeId, "minecraft:cobblestone_double_slab");
        assert.equal(fakePlayer.dimension.soundsPlayed[0].soundId, "use.stone");
    });

    it("registers custom item components on startup", () => {
        assert.ok(registeredCustomComponents.has("bh:stair_placer"), "bh:stair_placer must be registered");
        assert.ok(registeredCustomComponents.has("bh:log_placer"), "bh:log_placer must be registered");
        assert.ok(registeredCustomComponents.has("bh:slab_placer"), "bh:slab_placer must be registered");
    });

    it("triggers arm swing animation without invalid controller option", () => {
        let animationCall: { name: string; options?: any } | null = null;
        const mockPlayer = {
            isValid: true,
            playAnimation(name: string, options?: any) {
                animationCall = { name, options };
            }
        };

        playArmSwing(mockPlayer as any);

        assert.ok(animationCall);
        assert.equal((animationCall as any).name, "animation.player.place_swing");
        assert.equal((animationCall as any).options?.controller, undefined, "Must not specify nonexistent arm_swing controller");
    });
});
