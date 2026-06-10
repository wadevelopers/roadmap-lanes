---
id: EPIC-100
title: Checkout completo
type: combo
maturity: ready
status: pending
duration: 64
areas: [backend, frontend, pagos]
zones: [CheckoutService, CheckoutUI, PaymentGateway]
parent: "[[CC-2]]"
absorbs: []
depends_on: []
---

Épica que agrupa el flujo de compra de punta a punta: carrito, checkout y pago.
Sus hijas son `FT-001` (carrito) y `FT-002` (pasarela de pago).
