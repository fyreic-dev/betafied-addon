import { eventBus } from "../core/eventBus.js";

const CONFIG = Object.freeze({
    RESIST_DURATION: 10,
    RESIST_AMPLIFIER: 20
});

const givenResist = new Set<string>();

eventBus.onPlayerDimensionChange((event) => {
    const player = event.player;

    if (event.toDimension.id !== "minecraft:nether") return;
    if (givenResist.has(player.id)) return;

    player.addEffect("resistance", CONFIG.RESIST_DURATION * 20, {
        amplifier: CONFIG.RESIST_AMPLIFIER,
        showParticles: false
    });

    givenResist.add(player.id);
});

eventBus.onPlayerLeave((event) => {
    givenResist.delete(event.playerId);
});
