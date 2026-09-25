import {
    EquipmentSlot,
    EntityDamageCause,
    Player,
    ItemComponentTypes,
    EntityComponentTypes,
    GameMode,
    world
} from "@minecraft/server";
import { eventBus } from "../core/eventBus.js";
import { tickManager } from "../core/tickManager.js";
import { runCatching } from "../core/errorReporter.js";

const CONFIG = Object.freeze({
    REDUCTION_PER_POINT: 0.04,
    MAX_REDUCTION: 0.80
});

const ARMOR_TABLE: Readonly<Record<string, number>> = Object.freeze({
    "minecraft:leather_helmet": 1, "minecraft:leather_chestplate": 3,
    "minecraft:leather_leggings": 2, "minecraft:leather_boots": 1,
    "minecraft:golden_helmet": 2, "minecraft:golden_chestplate": 5,
    "minecraft:golden_leggings": 3, "minecraft:golden_boots": 1,
    "minecraft:chainmail_helmet": 2, "minecraft:chainmail_chestplate": 5,
    "minecraft:chainmail_leggings": 4, "minecraft:chainmail_boots": 1,
    "minecraft:iron_helmet": 2, "minecraft:iron_chestplate": 6,
    "minecraft:iron_leggings": 5, "minecraft:iron_boots": 2,
    "minecraft:diamond_helmet": 3, "minecraft:diamond_chestplate": 8,
    "minecraft:diamond_leggings": 6, "minecraft:diamond_boots": 3,
    "minecraft:netherite_helmet": 3, "minecraft:netherite_chestplate": 8,
    "minecraft:netherite_leggings": 6, "minecraft:netherite_boots": 3,
    "minecraft:turtle_helmet": 2
});

const BYPASS_SOURCES = Object.freeze(new Set([
    EntityDamageCause.fall,
    EntityDamageCause.fire,
    EntityDamageCause.fireTick,
    EntityDamageCause.lava,
    EntityDamageCause.drowning,
    EntityDamageCause.suffocation,
    EntityDamageCause.void,
    EntityDamageCause.starve,
    EntityDamageCause.magic,
    EntityDamageCause.wither,
    EntityDamageCause.flyIntoWall
]));

const SLOTS = Object.freeze([
    EquipmentSlot.Head,
    EquipmentSlot.Chest,
    EquipmentSlot.Legs,
    EquipmentSlot.Feet
]);

export function getBaseArmorPoints(typeId: string): number {
    const direct = ARMOR_TABLE[typeId];
    if (direct !== undefined) return direct;

    const colonIdx = typeId.indexOf(":");
    const baseName = colonIdx >= 0 ? typeId.substring(colonIdx + 1) : typeId;
    const mcEquivalent = `minecraft:${baseName}`;
    const mcDirect = ARMOR_TABLE[mcEquivalent];
    if (mcDirect !== undefined) return mcDirect;

    if (baseName.endsWith("_helmet") || baseName.endsWith("_cap")) return 2;
    if (baseName.endsWith("_chestplate") || baseName.endsWith("_tunic")) return 6;
    if (baseName.endsWith("_leggings") || baseName.endsWith("_pants")) return 5;
    if (baseName.endsWith("_boots")) return 2;

    return 0;
}

export function getEffectiveArmorPoints(player: Player): number {
    const equip = player.getComponent(EntityComponentTypes.Equippable);
    if (!equip) return 0;

    let points = 0;

    for (const slot of SLOTS) {
        const item = equip.getEquipment(slot);
        if (!item) continue;

        const base = getBaseArmorPoints(item.typeId);
        if (!base) continue;

        const dur = item.getComponent(ItemComponentTypes.Durability);
        if (dur && dur.maxDurability > 0) {
            const ratio = (dur.maxDurability - dur.damage) / dur.maxDurability;
            points += (base * ratio);
        } else {
            points += base;
        }
    }
    return points;
}

const lastSentArmorPoints = new Map<string, number>();

export function updatePlayerArmorDisplay(player: Player, force = false): void {
    if (!player.isValid) return;

    const isCreative = typeof player.getGameMode === "function" &&
        (player.getGameMode() === GameMode.Creative || player.getGameMode() === GameMode.Spectator);
    const current = isCreative ? 0 : Math.min(20, Math.max(0, Math.round(getEffectiveArmorPoints(player))));
    const last = lastSentArmorPoints.get(player.id);

    if (force || last === undefined || last !== current) {
        lastSentArmorPoints.set(player.id, current);
        runCatching({ system: "armor", operation: "updateDisplay", target: player.id }, () => {
            player.runCommand(`titleraw @s title {"rawtext":[{"text":"_a${current}"}]}`);
        });
    }
}

eventBus.onEntityHurt((ev) => {
    const player = ev.hurtEntity;
    const damage = ev.damage;
    const damageSource = ev.damageSource;

    if (!(player instanceof Player)) return;
    if (typeof player.getGameMode === "function" && player.getGameMode() === GameMode.Creative) return;
    if (BYPASS_SOURCES.has(damageSource.cause)) return;

    const points = getEffectiveArmorPoints(player);
    if (points > 0.1) {
        const reduction = Math.min(points * CONFIG.REDUCTION_PER_POINT, CONFIG.MAX_REDUCTION);
        const blockedDamage = damage * reduction;

        if (blockedDamage > 0) {
            const health = player.getComponent(EntityComponentTypes.Health);
            if (health && health.currentValue > 0) {
                const newHp = Math.min(health.currentValue + blockedDamage, health.effectiveMax);
                health.setCurrentValue(newHp);
            }
        }
    }

    updatePlayerArmorDisplay(player);
});

eventBus.onPlayerSpawn((ev) => {
    if (ev.player) {
        updatePlayerArmorDisplay(ev.player, true);
    }
});

eventBus.onPlayerLeave((ev) => {
    lastSentArmorPoints.delete(ev.playerId);
});

tickManager.register("armorDisplay", 5, () => {
    for (const player of world.getAllPlayers()) {
        updatePlayerArmorDisplay(player);
    }
});

