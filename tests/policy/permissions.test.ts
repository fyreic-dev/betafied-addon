import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GameMode } from "@minecraft/server";
import { isInventoryExempt, PRIVILEGED_TAGS } from "../../packs/BP/scripts/core/permissions.js";

describe("Permissions & Authorization Policy Tests", () => {
    it("exempts players in Creative mode", () => {
        const player = {
            id: "player_creative_1",
            name: "Steve",
            getGameMode: () => GameMode.Creative,
            hasTag: () => false
        };
        assert.equal(isInventoryExempt(player as any), true);
    });

    it("exempts survival players who have the builder_exempt privileged tag", () => {
        const player = {
            id: "player_staff_1",
            name: "Alex",
            getGameMode: () => GameMode.Survival,
            hasTag: (tag: string) => tag === PRIVILEGED_TAGS.BUILDER_EXEMPT
        };
        assert.equal(isInventoryExempt(player as any), true);
    });

    it("does not exempt standard survival players without privileged tags", () => {
        const player = {
            id: "player_survival_1",
            name: "Notch",
            getGameMode: () => GameMode.Survival,
            hasTag: () => false
        };
        assert.equal(isInventoryExempt(player as any), false);
    });

    it("does not exempt adventure mode players without tags", () => {
        const player = {
            id: "player_adv_1",
            name: "Herobrine",
            getGameMode: () => GameMode.Adventure,
            hasTag: () => false
        };
        assert.equal(isInventoryExempt(player as any), false);
    });
});
