export const HOURS_PER_DAY_OPTIONS = [4, 6, 8, 10, 12, 14] as const;

export type HoursPerDay = (typeof HOURS_PER_DAY_OPTIONS)[number];
export type BoardMode = "time" | "order";

export const DEFAULT_HOURS_PER_DAY: HoursPerDay = 8;
export const DEFAULT_HOURS_PER_LINE = 2;
export const DEFAULT_BOARD_MODE: BoardMode = "time";

const TIME_OPTION_EPSILON = 1e-6;

const HOURS_PER_LINE_OPTIONS: Record<HoursPerDay, readonly number[]> = {
	4: [1],
	6: [1, 1.5],
	8: [1, 1.5, 2],
	10: [1, 1.5, 2],
	12: [1, 1.5, 2],
	14: [1, 1.5, 2],
};

interface TimeScaleSettings {
	hoursPerDay: number;
	hoursPerLine: number;
}

export interface CardLayoutSettings {
	oneLineCardHeight: number;
	cardGap: number;
	orderCardHeight: number;
}

interface CardTimePresentation {
	timeUnits: number;
	semanticLines: number;
	visibleRows: number;
	height: number;
	durationBadge: string;
	durationDetail: string;
}

function parseNumber(value: unknown): number | null {
	const parsed = typeof value === "number" ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function isSameOption(a: number, b: number): boolean {
	return Math.abs(a - b) < TIME_OPTION_EPSILON;
}

export function normalizeHoursPerDay(value: unknown): HoursPerDay {
	const parsed = parseNumber(value);
	const match = HOURS_PER_DAY_OPTIONS.find((option) => option === parsed);
	return match ?? DEFAULT_HOURS_PER_DAY;
}

export function hoursPerLineOptionsForHoursPerDay(hoursPerDay: unknown): readonly number[] {
	return HOURS_PER_LINE_OPTIONS[normalizeHoursPerDay(hoursPerDay)];
}

export function defaultHoursPerLineForHoursPerDay(hoursPerDay: unknown): number {
	const normalizedHoursPerDay = normalizeHoursPerDay(hoursPerDay);
	const options = hoursPerLineOptionsForHoursPerDay(normalizedHoursPerDay);
	return options.find((option) => isSameOption(option, DEFAULT_HOURS_PER_LINE)) ?? options[options.length - 1];
}

export function normalizeHoursPerLine(value: unknown, hoursPerDay: unknown): number {
	const normalizedHoursPerDay = normalizeHoursPerDay(hoursPerDay);
	const parsed = parseNumber(value);
	const match = HOURS_PER_LINE_OPTIONS[normalizedHoursPerDay].find((option) =>
		parsed !== null && isSameOption(option, parsed)
	);
	return match ?? defaultHoursPerLineForHoursPerDay(normalizedHoursPerDay);
}

export function normalizeBoardMode(value: unknown): BoardMode {
	return value === "order" ? "order" : DEFAULT_BOARD_MODE;
}

function formatNumber(value: number, maxDecimals = 2): string {
	if (Number.isInteger(value)) return `${value}`;
	return value
		.toFixed(maxDecimals)
		.replace(/0+$/, "")
		.replace(/\.$/, "");
}

function isMultipleOf(value: number, divisor: number): boolean {
	if (divisor <= 0) return false;
	const quotient = value / divisor;
	return Math.abs(quotient - Math.round(quotient)) < 1e-9;
}

export function formatHoursPerLine(hoursPerLine: number): string {
	return formatNumber(hoursPerLine);
}

export function formatDurationBadge(hours: number, hoursPerDay: number): string {
	if (hours > 0 && isMultipleOf(hours, hoursPerDay)) {
		return `${formatNumber(hours / hoursPerDay)}d`;
	}
	return `${formatNumber(hours)}h`;
}

export function formatDurationDetail(hours: number, hoursPerDay: number): string {
	if (hours <= 0) return "0h";
	const fullDays = Math.floor(hours / hoursPerDay);
	const remainingHours = hours - fullDays * hoursPerDay;
	const total = `${formatNumber(hours)} h`;

	if (fullDays === 0) return `${formatNumber(hours)}h`;
	if (Math.abs(remainingHours) < 1e-9) return `${fullDays}d (${total})`;
	return `${fullDays}d + ${formatNumber(remainingHours)}h (${total})`;
}

export function semanticLinesForHours(
	hours: number,
	hoursPerLine: number
): number {
	if (hoursPerLine <= 0) return 1;
	return Math.max(1, Math.ceil(Math.max(0, hours) / hoursPerLine));
}

export function timeUnitsForHours(
	hours: number,
	hoursPerLine: number
): number {
	if (hoursPerLine <= 0) return 1;
	return Math.max(0, hours) / hoursPerLine;
}

export function visibleSemanticRows(semanticLines: number): number {
	return Math.min(4, Math.max(1, semanticLines));
}

export function timeCardHeight(
	timeUnits: number,
	layout: Pick<CardLayoutSettings, "oneLineCardHeight" | "cardGap">
): number {
	if (timeUnits <= 0) return 0;
	return Math.max(0, timeUnits * (layout.oneLineCardHeight + layout.cardGap) - layout.cardGap);
}

export function cardTimePresentation(
	hours: number,
	timeScale: TimeScaleSettings,
	layout: CardLayoutSettings,
	boardMode: BoardMode
): CardTimePresentation {
	const timeUnits = timeUnitsForHours(
		hours,
		timeScale.hoursPerLine
	);
	const semanticLines = semanticLinesForHours(
		hours,
		timeScale.hoursPerLine
	);
	const visibleRows = boardMode === "time" ? visibleSemanticRows(semanticLines) : 4;
	return {
		timeUnits,
		semanticLines,
		visibleRows,
		height:
			boardMode === "time"
				? timeCardHeight(timeUnits, layout)
				: layout.orderCardHeight,
		durationBadge: formatDurationBadge(hours, timeScale.hoursPerDay),
		durationDetail: formatDurationDetail(hours, timeScale.hoursPerDay),
	};
}
