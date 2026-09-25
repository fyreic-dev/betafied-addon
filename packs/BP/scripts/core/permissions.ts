import { Player, GameMode } from "@minecraft/server";

/**
 * Privileged tag assigned by server operators/admins to players who are exempt
 * from Beta 1.7.3 inventory restrictions (e.g. creative builders, staff).
 */
export const PRIVILEGED_TAGS = Object.freeze({
    BUILDER_EXEMPT: "builder_exempt"
} as const);

const auditLogCooldowns = new Map<string, number>();
const AUDIT_LOG_INTERVAL_MS = 60_000;

/**
 * Checks whether a player is authorized to bypass Beta inventory restrictions.
 * Returns true if the player is in Creative mode or holds the operator-controlled builder_exempt tag.
 * Emits periodic audit logs when the privileged exemption is exercised.
 */
export function isInventoryExempt(player: Player): boolean {
    if (player.getGameMode() === GameMode.Creative) {
        return true;
    }

    if (player.hasTag(PRIVILEGED_TAGS.BUILDER_EXEMPT)) {
        const now = Date.now();
        const lastLog = auditLogCooldowns.get(player.id) ?? 0;
        if (now - lastLog > AUDIT_LOG_INTERVAL_MS) {
            console.warn(`AUTH: Player '${player.name}' (${player.id}) bypassed inventory check via ${PRIVILEGED_TAGS.BUILDER_EXEMPT} tag.`);
            auditLogCooldowns.set(player.id, now);
        }
        return true;
    }

    return false;
}
