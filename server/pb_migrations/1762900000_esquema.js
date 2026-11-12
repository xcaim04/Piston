/// <reference path="../pb_data/types.d.ts" />

// Esquema del taller "El Pistón". Ver web/PLAN.md.
// Roles: recepcion (todo) y mecanico (lee todo, edita sus órdenes).

const SESION = "@request.auth.id != ''";
const RECEPCION = "@request.auth.rol = 'recepcion'";
const MECANICO = "@request.auth.rol = 'mecanico'";

migrate((app) => {
  // Usuarios: añadir nombre y rol al auth collection incluido.
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new TextField({ name: "nombre", required: false }));
  users.fields.add(new SelectField({ name: "rol", values: ["recepcion", "mecanico"], maxSelect: 1, required: false }));
  users.listRule = SESION;
  users.viewRule = SESION;
  app.save(users);

  const clientes = new Collection({
    type: "base",
    name: "clientes",
    fields: [
      new TextField({ name: "nombre", required: true }),
      new TextField({ name: "telefono", required: true }),
      new TextField({ name: "direccion" }),
    ],
    listRule: SESION,
    viewRule: SESION,
    createRule: `${RECEPCION}`,
    updateRule: `${RECEPCION}`,
    deleteRule: `${RECEPCION}`,
  });
  app.save(clientes);

  const vehiculos = new Collection({
    type: "base",
    name: "vehiculos",
    fields: [
      new RelationField({ name: "cliente", collectionId: clientes.id, required: true, maxSelect: 1, cascadeDelete: false }),
      new TextField({ name: "matricula", required: true }),
      new TextField({ name: "marca", required: true }),
      new TextField({ name: "modelo", required: true }),
      new NumberField({ name: "anio", onlyInt: true, min: 1950, max: 2100 }),
      new NumberField({ name: "km", onlyInt: true, min: 0 }),
    ],
    indexes: ["CREATE UNIQUE INDEX idx_vehiculos_matricula ON vehiculos (matricula)"],
    listRule: SESION,
    viewRule: SESION,
    createRule: `${RECEPCION}`,
    updateRule: `${RECEPCION}`,
    deleteRule: `${RECEPCION}`,
  });
  app.save(vehiculos);

  const repuestos = new Collection({
    type: "base",
    name: "repuestos",
    fields: [
      new TextField({ name: "nombre", required: true }),
      new TextField({ name: "codigo", required: true }),
      new NumberField({ name: "precio", required: true, min: 0 }),
      new NumberField({ name: "existencias", required: true, onlyInt: true, min: 0 }),
      new NumberField({ name: "minimo", onlyInt: true, min: 0 }),
    ],
    indexes: ["CREATE UNIQUE INDEX idx_repuestos_codigo ON repuestos (codigo)"],
    listRule: SESION,
    viewRule: SESION,
    createRule: `${RECEPCION}`,
    updateRule: `${RECEPCION}`,
    deleteRule: `${RECEPCION}`,
  });
  app.save(repuestos);

  const ordenes = new Collection({
    type: "base",
    name: "ordenes",
    fields: [
      new RelationField({ name: "vehiculo", collectionId: vehiculos.id, required: true, maxSelect: 1 }),
      new RelationField({ name: "mecanico", collectionId: users.id, required: true, maxSelect: 1 }),
      new DateField({ name: "fecha_entrada", required: true }),
      new DateField({ name: "fecha_entrega" }),
      new TextField({ name: "problema", required: true }),
      new NumberField({ name: "km_entrada", onlyInt: true, min: 0 }),
      new SelectField({
        name: "estado",
        required: true,
        maxSelect: 1,
        values: ["recibida", "en_diagnostico", "en_reparacion", "lista", "entregada", "cancelada"],
      }),
    ],
    listRule: SESION,
    viewRule: SESION,
    createRule: `${RECEPCION}`,
    updateRule: `${RECEPCION} || (${MECANICO} && mecanico = @request.auth.id)`,
    deleteRule: null,
  });
  app.save(ordenes);

  const trabajos = new Collection({
    type: "base",
    name: "trabajos",
    fields: [
      new RelationField({ name: "orden", collectionId: ordenes.id, required: true, maxSelect: 1, cascadeDelete: true }),
      new TextField({ name: "descripcion", required: true }),
      new NumberField({ name: "mano_obra", required: true, min: 0 }),
    ],
    listRule: SESION,
    viewRule: SESION,
    createRule: `${RECEPCION} || (${MECANICO} && orden.mecanico = @request.auth.id)`,
    updateRule: `${RECEPCION} || (${MECANICO} && orden.mecanico = @request.auth.id)`,
    deleteRule: `${RECEPCION}`,
  });
  app.save(trabajos);

  const ordenRepuestos = new Collection({
    type: "base",
    name: "orden_repuestos",
    fields: [
      new RelationField({ name: "orden", collectionId: ordenes.id, required: true, maxSelect: 1, cascadeDelete: true }),
      new RelationField({ name: "repuesto", collectionId: repuestos.id, required: true, maxSelect: 1 }),
      new NumberField({ name: "cantidad", required: true, onlyInt: true, min: 1 }),
      new NumberField({ name: "precio_unit", required: true, min: 0 }),
    ],
    listRule: SESION,
    viewRule: SESION,
    createRule: `${RECEPCION} || (${MECANICO} && orden.mecanico = @request.auth.id)`,
    updateRule: null,
    deleteRule: `${RECEPCION} || (${MECANICO} && orden.mecanico = @request.auth.id)`,
  });
  app.save(ordenRepuestos);

  const pagos = new Collection({
    type: "base",
    name: "pagos",
    fields: [
      new RelationField({ name: "orden", collectionId: ordenes.id, required: true, maxSelect: 1, cascadeDelete: true }),
      new NumberField({ name: "monto", required: true, min: 0.01 }),
      new DateField({ name: "fecha", required: true }),
      new SelectField({ name: "metodo", maxSelect: 1, values: ["efectivo", "tarjeta", "transferencia"] }),
    ],
    listRule: SESION,
    viewRule: SESION,
    createRule: `${RECEPCION}`,
    updateRule: null,
    deleteRule: `${RECEPCION}`,
  });
  app.save(pagos);
}, (app) => {
  for (const nombre of ["pagos", "orden_repuestos", "trabajos", "ordenes", "repuestos", "vehiculos", "clientes"]) {
    app.delete(app.findCollectionByNameOrId(nombre));
  }
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("nombre");
  users.fields.removeByName("rol");
  app.save(users);
});
