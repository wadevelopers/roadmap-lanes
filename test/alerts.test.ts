import { describe, expect, test } from "vitest";

import { alertFingerprint } from "../src/alerts";
import type { Alert } from "../src/types";

describe("alertFingerprint", () => {
	test("es estable aunque cambie el orden de params", () => {
		const a: Alert = {
			code: "unknown-area",
			severity: "warning",
			taskId: "DT-040",
			params: { value: "ux", id: "DT-040" },
		};
		const b: Alert = {
			code: "unknown-area",
			severity: "warning",
			taskId: "DT-040",
			params: { id: "DT-040", value: "ux" },
		};

		expect(alertFingerprint(a)).toBe(alertFingerprint(b));
	});

	test("cambia cuando cambian los valores de la alerta", () => {
		const base: Alert = {
			code: "unknown-zone",
			severity: "warning",
			taskId: "DT-040",
			params: { id: "DT-040", value: "BillingUI" },
		};
		const changed: Alert = {
			...base,
			params: { id: "DT-040", value: "CheckoutUI" },
		};

		expect(alertFingerprint(base)).not.toBe(alertFingerprint(changed));
	});
});
