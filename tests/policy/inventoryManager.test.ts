import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ItemStack } from "@minecraft/server";
import { evaluateItemAction } from "../../packs/BP/scripts/core/inventoryManager.js";

describe("Inventory Manager Item Normalization & Unstacking", () => {
    describe("Bow Normalization", () => {
        it("replaces vanilla minecraft:bow with authentic bh:bow", () => {
            const bowItem = new ItemStack("minecraft:bow", 1);
            const action = evaluateItemAction(bowItem);

            assert.equal(action.type, "replace");
            if (action.type === "replace") {
                assert.equal(action.item.typeId, "bh:bow");
                assert.equal(action.item.amount, 1);
            }
        });
    });

    describe("Placer Item Normalization", () => {
        it("replaces vanilla stairs, logs, and slabs with bh: equivalents", () => {
            const items = [
                { vanilla: "minecraft:oak_stairs", bh: "bh:oak_stairs" },
                { vanilla: "minecraft:oak_log", bh: "bh:oak_log" },
                { vanilla: "minecraft:birch_log", bh: "bh:birch_log" },
                { vanilla: "minecraft:spruce_log", bh: "bh:spruce_log" },
                { vanilla: "minecraft:cobblestone_slab", bh: "bh:cobblestone_slab" },
                { vanilla: "minecraft:sandstone_slab", bh: "bh:sandstone_slab" },
                { vanilla: "minecraft:smooth_stone_slab", bh: "bh:stone_slab" },
                { vanilla: "minecraft:stone_slab", bh: "bh:stone_slab" },
                { vanilla: "minecraft:oak_slab", bh: "bh:wooden_slab" }
            ];

            for (const { vanilla, bh } of items) {
                const action = evaluateItemAction(new ItemStack(vanilla, 5));
                assert.equal(action.type, "replace");
                if (action.type === "replace") {
                    assert.equal(action.item.typeId, bh);
                    assert.equal(action.item.amount, 5);
                }
            }
        });
    });

    describe("Utility Item Unstacking", () => {
        const unstackableUtilities = [
            "minecraft:wooden_door",
            "minecraft:iron_door",
            "minecraft:oak_sign",
            "minecraft:bucket"
        ];

        for (const typeId of unstackableUtilities) {
            it(`marks stacked ${typeId} (amount > 1) for unstacking`, () => {
                const item = new ItemStack(typeId, 3);
                const action = evaluateItemAction(item);

                assert.equal(action.type, "unstack_utility");
                if (action.type === "unstack_utility") {
                    assert.equal(action.targetId, typeId);
                    assert.equal(action.totalAmount, 3);
                }
            });

            it(`keeps single ${typeId} (amount === 1) as-is`, () => {
                const item = new ItemStack(typeId, 1);
                const action = evaluateItemAction(item);

                assert.equal(action.type, "keep");
            });
        }
    });
});
