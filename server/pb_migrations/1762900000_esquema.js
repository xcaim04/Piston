/// <reference path="../pb_data/types.d.ts" />

// Esquema del taller "El Pistón". Ver web/PLAN.md.
// Roles: recepcion (todo) y mecanico (lee todo, edita sus órdenes).
//
// Dos fases: primero se crean colecciones con sus campos, y después se aplican
// las reglas. Las reglas con relaciones (orden.mecanico) fallan si se validan
// antes de que el campo relación exista guardado.

const SESION = "@request.auth.id != ''";
const RECEPCION = "@request.auth.rol = 'recepcion'";
const MECANICO = "@request.auth.rol = 'mecanico'";

migrate((app) => {
  // En PocketBase 0.40 los campos pasados en el constructor se descartan:
  // hay que añadirlos con fields.add(). save() no devuelve el registro, así que
  // se guarda el mismo objeto y se usa.
  // created/updated: sin ellos, ordenar por "created" da error 400 en las consultas.
  const crear = ({ fields, ...definicion }) => {
    const coleccion = new Collection(definicion);
    for (const campo of fields) coleccion.fields.add(campo);
    coleccion.fields.add(new AutodateField({ name: "created", onCreate: true }));
    coleccion.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
    app.save(coleccion);
    return coleccion;
  };

  // Usuarios: añadir nombre y rol al auth collection incluido.
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new TextField({ name: "nombre", required: false }));
  users.fields.add(new SelectField({ name: "rol", values: ["recepcion", "mecanico"], maxSelect: 1, required: false }));
  app.save(users);

  // Fase 1: colecciones y campos.
  const clientes = crear({
    type: "base",
    name: "clientes",
    fields: [
      new TextField({ name: "nombre", required: true }),
      new TextField({ name: "telefono", required: true }),
      new TextField({ name: "direccion" }),
    ],
  });

  const vehiculos = crear({
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
  });

  const repuestos = crear({
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
  });

  const ordenes = crear({
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
  });

  const trabajos = crear({
    type: "base",
    name: "trabajos",
    fields: [
      new RelationField({ name: "orden", collectionId: ordenes.id, required: true, maxSelect: 1, cascadeDelete: true }),
      new TextField({ name: "descripcion", required: true }),
      new NumberField({ name: "mano_obra", required: true, min: 0 }),
    ],
  });

  const ordenRepuestos = crear({
    type: "base",
    name: "orden_repuestos",
    fields: [
      new RelationField({ name: "orden", collectionId: ordenes.id, required: true, maxSelect: 1, cascadeDelete: true }),
      new RelationField({ name: "repuesto", collectionId: repuestos.id, required: true, maxSelect: 1 }),
      new NumberField({ name: "cantidad", required: true, onlyInt: true, min: 1 }),
      new NumberField({ name: "precio_unit", required: true, min: 0 }),
    ],
  });

  const pagos = crear({
    type: "base",
    name: "pagos",
    fields: [
      new RelationField({ name: "orden", collectionId: ordenes.id, required: true, maxSelect: 1, cascadeDelete: true }),
      new NumberField({ name: "monto", required: true, min: 0.01 }),
      new DateField({ name: "fecha", required: true }),
      new SelectField({ name: "metodo", maxSelect: 1, values: ["efectivo", "tarjeta", "transferencia"] }),
    ],
  });

  // Fase 2: reglas de acceso. Cada colección se recarga desde la base antes de
  // asignarle reglas, para validarlas contra los campos ya guardados.
  const lectura = { listRule: SESION, viewRule: SESION };
  const soloRecepcion = { createRule: RECEPCION, updateRule: RECEPCION, deleteRule: RECEPCION };
  const duenoDeOrden = `${MECANICO} && orden.mecanico = @request.auth.id`;

  const reglas = {
    users: lectura,
    clientes: { ...lectura, ...soloRecepcion },
    vehiculos: { ...lectura, ...soloRecepcion },
    repuestos: { ...lectura, ...soloRecepcion },
    ordenes: {
      ...lectura,
      createRule: RECEPCION,
      updateRule: `${RECEPCION} || (${MECANICO} && mecanico = @request.auth.id)`,
      deleteRule: null,
    },
    trabajos: {
      ...lectura,
      createRule: `${RECEPCION} || (${duenoDeOrden})`,
      updateRule: `${RECEPCION} || (${duenoDeOrden})`,
      deleteRule: RECEPCION,
    },
    orden_repuestos: {
      ...lectura,
      createRule: `${RECEPCION} || (${duenoDeOrden})`,
      updateRule: null,
      deleteRule: `${RECEPCION} || (${duenoDeOrden})`,
    },
    pagos: { ...lectura, createRule: RECEPCION, updateRule: null, deleteRule: RECEPCION },
  };

  for (const [nombre, regla] of Object.entries(reglas)) {
    const coleccion = app.findCollectionByNameOrId(nombre);
    Object.assign(coleccion, regla);
    app.save(coleccion);
  }
}, (app) => {
  for (const nombre of ["pagos", "orden_repuestos", "trabajos", "ordenes", "repuestos", "vehiculos", "clientes"]) {
    app.delete(app.findCollectionByNameOrId(nombre));
  }
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("nombre");
  users.fields.removeByName("rol");
  app.save(users);
});
