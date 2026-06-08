---
id: EPIC-100
titulo: Checkout completo
# tipo / madurez / duracion: un contenedor no los declara (el tipo es de cada hoja; el resto se deriva)
# estado: se deriva de las tareas hijas
areas: [backend, frontend, pagos]
zonas: [CheckoutService, CheckoutUI, PaymentGateway]
padre:
absorbe: []
depende_de: []
# duracion: se deriva de las tareas hijas
---

Épica que agrupa el flujo de compra de punta a punta: carrito, checkout y pago.
Sus hijas son `FT-001` (carrito) y `FT-002` (pasarela de pago).
