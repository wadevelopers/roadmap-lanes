---
id: EPIC-100
titulo: Checkout completo
tipo: COMBO
madurez: ejecutable
estado: pendiente
duracion: 64
areas: [backend, frontend, pagos]
zonas: [CheckoutService, CheckoutUI, PaymentGateway]
padre: "[[CC-2]]"
absorbe: []
depende_de: []
---

Épica que agrupa el flujo de compra de punta a punta: carrito, checkout y pago.
Sus hijas son `FT-001` (carrito) y `FT-002` (pasarela de pago).
