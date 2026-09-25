/**
 * Standardized error reporter and error boundary helper for Betafied scripts.
 */

export interface ErrorContext {
    system: string;
    operation: string;
    target?: string;
    details?: Record<string, unknown>;
}

export function reportError(context: ErrorContext, error: unknown): void {
    const errorMsg = error instanceof Error ? error.stack || error.message : String(error);
    const targetInfo = context.target ? ` [target: ${context.target}]` : "";
    const detailEntries = context.details
        ? ` (${Object.entries(context.details).map(([k, v]) => `${k}=${String(v)}`).join(", ")})`
        : "";
    console.warn(`${context.system}: Error during ${context.operation}${targetInfo}${detailEntries}: ${errorMsg}`);
}

export function runCatching<T>(context: ErrorContext, fn: () => T, fallback?: (err: unknown) => T): T | undefined {
    try {
        return fn();
    } catch (err) {
        reportError(context, err);
        if (fallback) {
            return fallback(err);
        }
        return undefined;
    }
}
