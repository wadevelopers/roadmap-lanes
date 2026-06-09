import type { Alerta } from "./types";

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

export function alertFingerprint(alerta: Alerta): string {
	return JSON.stringify({
		codigo: alerta.codigo,
		severidad: alerta.severidad,
		tareaId: alerta.tareaId ?? null,
		params: stableValue(alerta.params ?? {}),
	});
}
