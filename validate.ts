import process from "node:process";

import {
	formatAlertsText,
	formatReportText,
	validationExitCode,
	validationJsonPayload,
	validateRoadmapDirectory,
	type ValidateRoadmapOptions,
	type ValidatorLanguage,
} from "./src/validator";

interface ParsedArgs {
	roadmapDir: string;
	options: ValidateRoadmapOptions;
}

function usage(): string {
	return [
		"Usage: node validate.js <roadmap-folder> [--json] [--report] [--strict] [--hours-per-day N] [--lang en|es]",
		"",
		"Validates a Roadmap Lanes folder using the same model alerts as the Obsidian board.",
	].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
	const options: ValidateRoadmapOptions = {};
	let roadmapDir: string | undefined;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--json") {
			options.json = true;
		} else if (arg === "--report") {
			options.report = true;
		} else if (arg === "--strict") {
			options.strict = true;
		} else if (arg === "--hours-per-day") {
			const value = argv[++i];
			if (!value) throw new Error("--hours-per-day requires a value");
			options.hoursPerDay = Number(value);
		} else if (arg === "--lang") {
			const value = argv[++i];
			if (value !== "en" && value !== "es") throw new Error("--lang must be 'en' or 'es'");
			options.lang = value as ValidatorLanguage;
		} else if (arg.startsWith("--")) {
			throw new Error(`Unknown option: ${arg}`);
		} else if (!roadmapDir) {
			roadmapDir = arg;
		} else {
			throw new Error(`Unexpected argument: ${arg}`);
		}
	}
	if (!roadmapDir) throw new Error("Missing roadmap folder");
	return { roadmapDir, options };
}

async function main(): Promise<void> {
	let parsed: ParsedArgs;
	try {
		parsed = parseArgs(process.argv.slice(2));
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		console.error(usage());
		process.exitCode = 1;
		return;
	}

	const result = await validateRoadmapDirectory(parsed.roadmapDir, parsed.options);
	for (const diagnostic of result.diagnostics) console.warn(diagnostic);

	if (parsed.options.json) {
		console.log(JSON.stringify(validationJsonPayload(result, parsed.options.report), null, 2));
	} else {
		const sections = [formatAlertsText(result.alerts, parsed.options.lang ?? "en")];
		if (parsed.options.report) {
			sections.push(
				formatReportText(result.model, result.report, { hoursPerDay: parsed.options.hoursPerDay })
			);
		}
		console.log(sections.join("\n\n"));
	}
	process.exitCode = validationExitCode(result.alerts, parsed.options.strict);
}

void main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
