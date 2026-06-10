import type { Alert } from "./types";

type FingerprintValue = string | number | boolean | null | FingerprintValue[] | {
	[key: string]: FingerprintValue;
};

function stableValue(value: unknown): FingerprintValue {
	if (value === null) return null;
	if (Array.isArray(value)) return value.map(stableValue);
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return value;
	}
	if (typeof value !== "object") return String(value);

	const result: Record<string, FingerprintValue> = {};
	for (const key of Object.keys(value as Record<string, unknown>).sort()) {
		result[key] = stableValue((value as Record<string, unknown>)[key]);
	}
	return result;
}

export function alertFingerprint(alert: Alert): string {
	return JSON.stringify({
		code: alert.code,
		severity: alert.severity,
		taskId: alert.taskId ?? null,
		params: stableValue(alert.params ?? {}),
	});
}
