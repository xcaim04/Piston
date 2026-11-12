// Control de existencias: usar un repuesto en una orden lo descuenta;
// quitarlo de la orden lo devuelve. El precio se fija en el servidor.
// Ver web/PLAN.md, fase 4.

onRecordCreate((e) => {
  const repuesto = e.app.findRecordById("repuestos", e.record.get("repuesto"));
  const cantidad = e.record.getInt("cantidad");
  const existencias = repuesto.getInt("existencias");

  if (existencias < cantidad) {
    throw new BadRequestError(`Solo quedan ${existencias} unidades de ${repuesto.get("nombre")}.`);
  }

  // Precio de venta del momento, no el que envía el cliente.
  e.record.set("precio_unit", repuesto.get("precio"));

  // shortcut: descuento y creación no van en una sola transacción explícita;
  // si e.next() falla, las existencias quedarían bajas. Usar e.app.runInTransaction al crecer.
  repuesto.set("existencias", existencias - cantidad);
  e.app.save(repuesto);

  e.next();
}, "orden_repuestos");

onRecordDelete((e) => {
  const repuesto = e.app.findRecordById("repuestos", e.record.get("repuesto"));
  repuesto.set("existencias", repuesto.getInt("existencias") + e.record.getInt("cantidad"));
  e.app.save(repuesto);

  e.next();
}, "orden_repuestos");
