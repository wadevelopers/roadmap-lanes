import { describe, expect, test } from "vitest";

import {
	defaultHoursPerLineForHoursPerDay,
	formatDurationBadge,
	formatDurationDetail,
	formatHoursPerLine,
	hoursPerLineOptionsForHoursPerDay,
	normalizeHoursPerLine,
	normalizeHoursPerDay,
	semanticLinesForHours,
	timeCardHeight,
	timeUnitsForHours,
	visibleSemanticRows,
} from "../src/time";

describe("time helpers", () => {
	test("normaliza jornada y precisión temporal a opciones permitidas", () => {
		expect(normalizeHoursPerDay(12)).toBe(12);
		expect(normalizeHoursPerDay(7)).toBe(8);
		expect(normalizeHoursPerLine(1.5, 6)).toBe(1.5);
		expect(normalizeHoursPerLine(2, 6)).toBe(1.5);
		expect(normalizeHoursPerLine(2, 8)).toBe(2);
		expect(defaultHoursPerLineForHoursPerDay(14)).toBe(2);
	});

	test("expone opciones directas de horas por línea", () => {
		const labels = (hoursPerDay: number) =>
			hoursPerLineOptionsForHoursPerDay(hoursPerDay).map(formatHoursPerLine);
		expect(labels(4)).toEqual(["1"]);
		expect(labels(6)).toEqual(["1", "1.5"]);
		expect(labels(8)).toEqual(["1", "1.5", "2"]);
		expect(labels(10)).toEqual(["1", "1.5", "2"]);
		expect(labels(12)).toEqual(["1", "1.5", "2"]);
		expect(labels(14)).toEqual(["1", "1.5", "2"]);
	});

	test("calcula líneas temporales con ceil y mínimo una línea", () => {
		expect(semanticLinesForHours(0.5, 2)).toBe(1);
		expect(semanticLinesForHours(2, 2)).toBe(1);
		expect(semanticLinesForHours(3, 2)).toBe(2);
		expect(semanticLinesForHours(8, 1)).toBe(8);
	});

	test("calcula unidades temporales reales para altura sin redondear por card", () => {
		expect(timeUnitsForHours(1, 2)).toBe(0.5);
		expect(timeUnitsForHours(3, 2)).toBe(1.5);
		expect(timeUnitsForHours(15, 2)).toBe(7.5);
	});

	test("oculta filas semánticas desde abajo cuando hay menos de cuatro líneas", () => {
		expect(visibleSemanticRows(1)).toBe(1);
		expect(visibleSemanticRows(3)).toBe(3);
		expect(visibleSemanticRows(8)).toBe(4);
	});

	test("altura temporal equivale a N cards de una línea más N-1 gaps", () => {
		const layout = { oneLineCardHeight: 28, cardGap: 8 };
		expect(timeCardHeight(0.5, layout)).toBe(10);
		expect(timeCardHeight(1, layout)).toBe(28);
		expect(timeCardHeight(4, layout)).toBe(136);
		expect(timeCardHeight(8, layout)).toBe(280);
	});

	test("altura apilada respeta la suma real de horas aunque haya fracciones", () => {
		const layout = { oneLineCardHeight: 28, cardGap: 8 };
		const cardGap = layout.cardGap;
		const height15h = timeCardHeight(timeUnitsForHours(15, 2), layout);
		const stacked1To5 =
			[1, 2, 3, 4, 5]
				.map((hours) => timeCardHeight(timeUnitsForHours(hours, 2), layout))
				.reduce((sum, height) => sum + height, 0) +
			4 * cardGap;

		expect(stacked1To5).toBe(height15h);
	});

	test("badge usa días sólo cuando la duración cae en días exactos", () => {
		expect(formatDurationBadge(16, 8)).toBe("2d");
		expect(formatDurationBadge(12, 8)).toBe("12h");
		expect(formatDurationBadge(4, 8)).toBe("4h");
	});

	test("detalle conserva el desglose real en horas", () => {
		expect(formatDurationDetail(16, 8)).toBe("2d (16 h)");
		expect(formatDurationDetail(12, 8)).toBe("1d + 4h (12 h)");
		expect(formatDurationDetail(4, 8)).toBe("4h");
	});
});
