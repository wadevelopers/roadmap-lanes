import { describe, expect, test } from "vitest";

import { alertFingerprint } from "../src/alerts";
import type { Alerta } from "../src/types";

describe("alertFingerprint", () => {
	test("es estable aunque cambie el orden de params", () => {
		const a: Alerta = {
			codigo: "area-desconocida",
			severidad: "warning",
			tareaId: "DT-040",
			params: { valor: "ux", id: "DT-040" },
		};
		const b: Alerta = {
			codigo: "area-desconocida",
			severidad: "warning",
			tareaId: "DT-040",
			params: { id: "DT-040", valor: "ux" },
		};

		expect(alertFingerprint(a)).toBe(alertFingerprint(b));
	});

	test("cambia cuando cambian los valores de la alerta", () => {
		const base: Alerta = {
			codigo: "zona-desconocida",
			severidad: "warning",
			tareaId: "DT-040",
			params: { id: "DT-040", valor: "BillingUI" },
		};
		const changed: Alerta = {
			...base,
			params: { id: "DT-040", valor: "CheckoutUI" },
		};

		expect(alertFingerprint(base)).not.toBe(alertFingerprint(changed));
	});
});
