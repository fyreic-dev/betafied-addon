import {
    world,
    system,
    ItemStack,
    Player,
    Container,
    ItemComponentTypes,
    EntityComponentTypes
} from "@minecraft/server";
import { isInventoryExempt } from "./permissions.js";
import { reportError } from "./errorReporter.js";
import { isBetaItem } from "./betaRegistry.js";
import { normalizeItem } from "./normalizer.js";
import { tickManager } from "./tickManager.js";
import { eventBus } from "./eventBus.js";

const CONFIG = Object.freeze({
    CHECK_INTERVAL: 5,  // faster checks to prevent placement exploit
    MESSAGE_COOLDOWN: 60,
    REMOVE_MSG: "§c[Betafied] §7That item doesn't exist in Beta 1.7.3!",
    ENCHANT_MSG: "§c[Betafied] §7Enchantments removed! Beta 1.7.3 had no enchanting."
});

const FOOD_CONVERSIONS: Readonly<Record<string, string>> = Object.freeze({
    "minecraft:apple": "bh:apple",
    "minecraft:bread": "bh:bread",
    "minecraft:porkchop": "bh:porkchop",
    "minecraft:cooked_porkchop": "bh:cooked_porkchop",
    "minecraft:cod": "bh:cod",
    "minecraft:cooked_cod": "bh:cooked_cod",
    "minecraft:golden_apple": "bh:golden_apple",
    "minecraft:cookie": "bh:cookie",
    "minecraft:salmon": "bh:cod",
    "minecraft:cooked_salmon": "bh:cooked_cod"
});

const PLACER_ITEM_CONVERSIONS: Readonly<Record<string, string>> = Object.freeze({
    "minecraft:oak_stairs": "bh:oak_stairs",
    "minecraft:oak_log": "bh:oak_log",
    "minecraft:birch_log": "bh:birch_log",
    "minecraft:spruce_log": "bh:spruce_log",
    "minecraft:cobblestone_slab": "bh:cobblestone_slab",
    "minecraft:sandstone_slab": "bh:sandstone_slab",
    "minecraft:smooth_stone_slab": "bh:stone_slab",
    "minecraft:stone_slab": "bh:stone_slab",
    "minecraft:oak_slab": "bh:wooden_slab"
});

const UNSTACKABLE_UTILITIES: Readonly<Set<string>> = Object.freeze(new Set([
    "minecraft:wooden_door",
    "minecraft:iron_door",
    "minecraft:oak_sign",
    "minecraft:bucket"
]));

const msgCooldowns = new Map<string, number>();

/**
 * Generator for periodic asynchronous player inventory processing.
 */
export function* processPlayers(): Generator<void, void, unknown> {
    const players = world.getAllPlayers();

    for (const player of players) {
        try {
            if (isInventoryExempt(player)) {
                yield;
                continue;
            }
            processInventory(player);
        } catch (e) {
            reportError({
                system: "InventoryManager",
                operation: "processInventory",
                target: player.name
            }, e);
        }
        yield;
    }
}

tickManager.register("inventoryManager", CONFIG.CHECK_INTERVAL, processPlayers, 0);

type ItemNormalizationAction =
    | { type: "keep" }
    | { type: "delete"; reason: "banned" | "unsupported" }
    | { type: "replace"; item: ItemStack }
    | { type: "unstack_food"; convertedId: string; totalAmount: number }
    | { type: "unstack_utility"; targetId: string; totalAmount: number }
    | { type: "strip_enchantments"; item: ItemStack };

function preserveDurability(sourceItem: ItemStack, targetItem: ItemStack): void {
    const oldDur = sourceItem.getComponent(ItemComponentTypes.Durability);
    const newDur = targetItem.getComponent(ItemComponentTypes.Durability);
    if (oldDur && newDur) {
        newDur.damage = oldDur.damage;
    }
}

export function evaluateItemAction(item: ItemStack): ItemNormalizationAction {
    const id = item.typeId;

    if (id === "minecraft:bow") {
        const replacement = new ItemStack("bh:bow", item.amount);
        preserveDurability(item, replacement);
        return { type: "replace", item: replacement };
    }

    if (PLACER_ITEM_CONVERSIONS[id]) {
        return { type: "replace", item: new ItemStack(PLACER_ITEM_CONVERSIONS[id], item.amount) };
    }

    if (FOOD_CONVERSIONS[id]) {
        return { type: "unstack_food", convertedId: FOOD_CONVERSIONS[id], totalAmount: item.amount };
    }

    if (UNSTACKABLE_UTILITIES.has(id) && item.amount > 1) {
        return { type: "unstack_utility", targetId: id, totalAmount: item.amount };
    }

    const norm = normalizeItem(id);
    if (norm.action === "remove") {
        return { type: "delete", reason: "banned" };
    }

    if (norm.action === "convert" && norm.targetId) {
        const replacement = new ItemStack(norm.targetId, item.amount);
        preserveDurability(item, replacement);
        return { type: "replace", item: replacement };
    }

    const enchantable = item.getComponent(ItemComponentTypes.Enchantable);
    if (enchantable && enchantable.getEnchantments().length > 0) {
        const cleanItem = new ItemStack(id, item.amount);
        preserveDurability(item, cleanItem);
        return { type: "strip_enchantments", item: cleanItem };
    }

    if (!isBetaItem(id)) {
        return { type: "delete", reason: "unsupported" };
    }

    return { type: "keep" };
}

function handleItemUnstacking(player: Player, inv: Container, slotIndex: number, targetId: string, amount: number): void {
    inv.setItem(slotIndex, new ItemStack(targetId, 1));
    if (amount <= 1) return;

    let remaining = amount - 1;
    for (let s = 0; s < inv.size && remaining > 0; s++) {
        if (!inv.getItem(s)) {
            inv.setItem(s, new ItemStack(targetId, 1));
            remaining--;
        }
    }

    if (remaining > 0) {
        player.dimension.spawnItem(new ItemStack(targetId, remaining), player.location);
    }
}

export function processInventory(player: Player): void {
    const invComp = player.getComponent(EntityComponentTypes.Inventory);
    const inv = invComp?.container;
    if (!inv) return;

    let removed = false;
    let stripped = false;

    for (let i = 0; i < inv.size; i++) {
        const item = inv.getItem(i);
        if (!item) continue;

        const action = evaluateItemAction(item);

        switch (action.type) {
            case "keep":
                break;
            case "delete":
                inv.setItem(i, undefined);
                removed = true;
                if (action.reason === "unsupported") {
                    console.log(`INV: Removed ${item.typeId} from ${player.name}`);
                }
                break;
            case "replace":
                inv.setItem(i, action.item);
                break;
            case "strip_enchantments":
                inv.setItem(i, action.item);
                stripped = true;
                break;
            case "unstack_food":
                handleItemUnstacking(player, inv, i, action.convertedId, action.totalAmount);
                break;
            case "unstack_utility":
                handleItemUnstacking(player, inv, i, action.targetId, action.totalAmount);
                break;
            default:
                break;
        }
    }

    if (removed) notifyPlayer(player, CONFIG.REMOVE_MSG);
    if (stripped) notifyPlayer(player, CONFIG.ENCHANT_MSG);
}

function notifyPlayer(player: Player, msg: string): void {
    const now = system.currentTick;
    const last = msgCooldowns.get(player.id) ?? 0;
    if (now - last >= CONFIG.MESSAGE_COOLDOWN) {
        player.sendMessage(msg);
        msgCooldowns.set(player.id, now);
    }
}

eventBus.onPlayerLeave((ev) => {
    msgCooldowns.delete(ev.playerId);
});
