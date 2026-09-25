import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    getBaseArmorPoints,
    getEffectiveArmorPoints,
    updatePlayerArmorDisplay
} from "../../packs/BP/scripts/combat/armor.js";
import {
    Player,
    EquipmentSlot,
    EntityComponentTypes,
    ItemComponentTypes,
    GameMode
} from "../mocks/minecraftServer.js";

describe("Beta Armor Points & Titleraw HUD Display", () => {
    describe("getBaseArmorPoints", () => {
        it("returns authentic points for vanilla armor", () => {
            assert.equal(getBaseArmorPoints("minecraft:diamond_helmet"), 3);
            assert.equal(getBaseArmorPoints("minecraft:diamond_chestplate"), 8);
            assert.equal(getBaseArmorPoints("minecraft:diamond_leggings"), 6);
            assert.equal(getBaseArmorPoints("minecraft:diamond_boots"), 3);
            assert.equal(getBaseArmorPoints("minecraft:iron_chestplate"), 6);
            assert.equal(getBaseArmorPoints("minecraft:leather_helmet"), 1);
        });

        it("correctly resolves custom namespace armor matching vanilla names", () => {
            assert.equal(getBaseArmorPoints("bh:diamond_helmet"), 3);
            assert.equal(getBaseArmorPoints("bh:diamond_chestplate"), 8);
            assert.equal(getBaseArmorPoints("custom:iron_boots"), 2);
        });

        it("provides fallback heuristics for arbitrary custom armor pieces", () => {
            assert.equal(getBaseArmorPoints("custom:ruby_chestplate"), 6);
            assert.equal(getBaseArmorPoints("custom:obsidian_helmet"), 2);
            assert.equal(getBaseArmorPoints("custom:emerald_leggings"), 5);
            assert.equal(getBaseArmorPoints("custom:topaz_boots"), 2);
        });

        it("returns 0 for non-armor items", () => {
            assert.equal(getBaseArmorPoints("minecraft:stick"), 0);
            assert.equal(getBaseArmorPoints("minecraft:apple"), 0);
        });
    });

    describe("getEffectiveArmorPoints", () => {
        it("returns 0 when player has no equippable component or no armor", () => {
            const player = new Player();
            assert.equal(getEffectiveArmorPoints(player as any), 0);
        });

        it("calculates 20 full points for undamaged diamond armor", () => {
            const player = new Player();
            const equipment = new Map<EquipmentSlot, any>([
                [EquipmentSlot.Head, { typeId: "minecraft:diamond_helmet", getComponent: () => null }],
                [EquipmentSlot.Chest, { typeId: "minecraft:diamond_chestplate", getComponent: () => null }],
                [EquipmentSlot.Legs, { typeId: "minecraft:diamond_leggings", getComponent: () => null }],
                [EquipmentSlot.Feet, { typeId: "minecraft:diamond_boots", getComponent: () => null }]
            ]);

            player.setComponent(EntityComponentTypes.Equippable, {
                getEquipment: (slot: EquipmentSlot) => equipment.get(slot) || null
            });

            const points = getEffectiveArmorPoints(player as any);
            assert.equal(points, 20);
        });

        it("scales points proportionally to durability for damaged armor", () => {
            const player = new Player();
            const equipment = new Map<EquipmentSlot, any>([
                [EquipmentSlot.Chest, {
                    typeId: "minecraft:diamond_chestplate",
                    getComponent: (type: string) => {
                        if (type === ItemComponentTypes.Durability) {
                            return { maxDurability: 100, damage: 50 };
                        }
                        return null;
                    }
                }]
            ]);

            player.setComponent(EntityComponentTypes.Equippable, {
                getEquipment: (slot: EquipmentSlot) => equipment.get(slot) || null
            });

            const points = getEffectiveArmorPoints(player as any);
            assert.equal(points, 4); // 8 base * 50% durability = 4 points
        });
    });

    describe("updatePlayerArmorDisplay", () => {
        it("broadcasts titleraw command with _a prefix and points to update the HUD", () => {
            const player = new Player();
            player.id = "test_player_armor_1";

            const equipment = new Map<EquipmentSlot, any>([
                [EquipmentSlot.Chest, { typeId: "minecraft:diamond_chestplate", getComponent: () => null }]
            ]);

            player.setComponent(EntityComponentTypes.Equippable, {
                getEquipment: (slot: EquipmentSlot) => equipment.get(slot) || null
            });

            updatePlayerArmorDisplay(player as any, true);

            assert.equal(player.commandsRun.length, 1);
            assert.equal(player.commandsRun[0], 'titleraw @s title {"rawtext":[{"text":"_a8"}]}');
        });

        it("does not re-broadcast titleraw if armor points remain unchanged", () => {
            const player = new Player();
            player.id = "test_player_armor_2";

            const equipment = new Map<EquipmentSlot, any>([
                [EquipmentSlot.Chest, { typeId: "minecraft:diamond_chestplate", getComponent: () => null }]
            ]);

            player.setComponent(EntityComponentTypes.Equippable, {
                getEquipment: (slot: EquipmentSlot) => equipment.get(slot) || null
            });

            updatePlayerArmorDisplay(player as any, true);
            assert.equal(player.commandsRun.length, 1);

            // Second call with same armor should not run command
            updatePlayerArmorDisplay(player as any, false);
            assert.equal(player.commandsRun.length, 1);
        });

        it("sends _a0 and suppresses armor display when player is in Creative mode", () => {
            const player = new Player();
            player.id = "test_player_creative";
            player.gameMode = GameMode.Creative;

            const equipment = new Map<EquipmentSlot, any>([
                [EquipmentSlot.Chest, { typeId: "minecraft:diamond_chestplate", getComponent: () => null }]
            ]);

            player.setComponent(EntityComponentTypes.Equippable, {
                getEquipment: (slot: EquipmentSlot) => equipment.get(slot) || null
            });

            updatePlayerArmorDisplay(player as any, true);

            assert.equal(player.commandsRun.length, 1);
            assert.equal(player.commandsRun[0], 'titleraw @s title {"rawtext":[{"text":"_a0"}]}');
        });

        it("updates display to _a0 when switching from Survival to Creative, and restores upon return", () => {
            const player = new Player();
            player.id = "test_player_switch";
            player.gameMode = GameMode.Survival;

            const equipment = new Map<EquipmentSlot, any>([
                [EquipmentSlot.Chest, { typeId: "minecraft:diamond_chestplate", getComponent: () => null }]
            ]);

            player.setComponent(EntityComponentTypes.Equippable, {
                getEquipment: (slot: EquipmentSlot) => equipment.get(slot) || null
            });

            // In survival, displays 8 armor points
            updatePlayerArmorDisplay(player as any, true);
            assert.equal(player.commandsRun[player.commandsRun.length - 1], 'titleraw @s title {"rawtext":[{"text":"_a8"}]}');

            // Switch to creative mode
            player.gameMode = GameMode.Creative;
            updatePlayerArmorDisplay(player as any, false);
            assert.equal(player.commandsRun[player.commandsRun.length - 1], 'titleraw @s title {"rawtext":[{"text":"_a0"}]}');

            // Switch back to survival mode
            player.gameMode = GameMode.Survival;
            updatePlayerArmorDisplay(player as any, false);
            assert.equal(player.commandsRun[player.commandsRun.length - 1], 'titleraw @s title {"rawtext":[{"text":"_a8"}]}');
        });

        it("suppresses armor display when player is in Spectator mode", () => {
            const player = new Player();
            player.id = "test_player_spectator";
            player.gameMode = GameMode.Spectator;

            const equipment = new Map<EquipmentSlot, any>([
                [EquipmentSlot.Chest, { typeId: "minecraft:diamond_chestplate", getComponent: () => null }]
            ]);

            player.setComponent(EntityComponentTypes.Equippable, {
                getEquipment: (slot: EquipmentSlot) => equipment.get(slot) || null
            });

            updatePlayerArmorDisplay(player as any, true);

            assert.equal(player.commandsRun.length, 1);
            assert.equal(player.commandsRun[0], 'titleraw @s title {"rawtext":[{"text":"_a0"}]}');
        });
    });
});
