import * as yaml from "js-yaml";

export const ACCEPTED_ALERTS_FILENAME = "accepted-alerts.yaml";

export interface AcceptedAlertsParseResult {
	fingerprints: Set<string>;
	warning?: string;
}

export function normalizeAcceptedAlertFingerprints(value: unknown): Set<string> {
	if (!Array.isArray(value)) return new Set();
	return new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0));
}

export function parseAcceptedAlertsYaml(raw: string, source = ACCEPTED_ALERTS_FILENAME): AcceptedAlertsParseResult {
	try {
		const data = (yaml.load(raw) || {}) as { accepted?: unknown };
		return { fingerprints: normalizeAcceptedAlertFingerprints(data.accepted) };
	} catch (error) {
		return {
			fingerprints: new Set(),
			warning: `${source}: could not parse accepted alerts; treating as empty`,
		};
	}
}

export function serializeAcceptedAlerts(fingerprints: Iterable<string>): string {
	const accepted = [...fingerprints].filter((item) => item.length > 0).sort();
	if (accepted.length === 0) return "accepted: []\n";
	return `accepted:\n${accepted.map((item) => `  - ${JSON.stringify(item)}`).join("\n")}\n`;
}
