// Prueba de humo contra un servidor PocketBase recién creado.
// Cubre: reglas por rol, precio fijado en el servidor, descuento y devolución de existencias.
//
// Uso (con el servidor corriendo y un superusuario creado):
//   PB_SU_EMAIL=admin@local.test PB_SU_PASS=... node pruebas/smoke.mjs
// Crea datos de prueba: usar una base de datos de desarrollo.

const BASE = process.env.PB_URL ?? "http://127.0.0.1:8090";
const SU_EMAIL = process.env.PB_SU_EMAIL;
const SU_PASS = process.env.PB_SU_PASS;
if (!SU_EMAIL || !SU_PASS) {
  console.error("Faltan PB_SU_EMAIL y PB_SU_PASS.");
  process.exit(2);
}

let fallos = 0;
function comprobar(cond, texto) {
  console.log(`${cond ? "ok    " : "FALLA "} ${texto}`);
  if (!cond) fallos++;
}

async function api(metodo, ruta, { token, cuerpo } = {}) {
  const res = await fetch(BASE + ruta, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await res.text();
  return { status: res.status, data: texto ? JSON.parse(texto) : null };
}

const sufijo = Date.now().toString(36);
const PASS = "clave-de-prueba-123";

// 1. Superusuario y usuarios de prueba.
const su = await api("POST", "/api/collections/_superusers/auth-with-password", {
  cuerpo: { identity: SU_EMAIL, password: SU_PASS },
});
comprobar(su.status === 200, "superusuario autenticado");
const suToken = su.data.token;

let usuarios = 0;
async function crearUsuario(rol) {
  const email = `${rol}-${sufijo}-${++usuarios}@local.test`;
  const r = await api("POST", "/api/collections/users/records", {
    token: suToken,
    cuerpo: { email, password: PASS, passwordConfirm: PASS, nombre: rol, rol, verified: true },
  });
  comprobar(r.status === 200, `usuario ${rol} creado`);
  const login = await api("POST", "/api/collections/users/auth-with-password", {
    cuerpo: { identity: email, password: PASS },
  });
  return { id: r.data.id, token: login.data.token };
}

const rec = await crearUsuario("recepcion");
const meca = await crearUsuario("mecanico");
const otroMeca = await crearUsuario("mecanico");

// 2. Datos base, creados por recepción.
const cliente = await api("POST", "/api/collections/clientes/records", {
  token: rec.token, cuerpo: { nombre: "Cliente de prueba", telefono: "555-0100" },
});
comprobar(cliente.status === 200, "recepción crea cliente");

const vehiculo = await api("POST", "/api/collections/vehiculos/records", {
  token: rec.token,
  cuerpo: { cliente: cliente.data.id, matricula: `P-${sufijo}`, marca: "Toyota", modelo: "Corolla", anio: 2015, km: 50000 },
});
comprobar(vehiculo.status === 200, "recepción crea vehículo");

const repuesto = await api("POST", "/api/collections/repuestos/records", {
  token: rec.token,
  cuerpo: { nombre: "Filtro de aceite", codigo: `FA-${sufijo}`, precio: 12.5, existencias: 5, minimo: 3 },
});
comprobar(repuesto.status === 200, "recepción crea repuesto");

const orden = await api("POST", "/api/collections/ordenes/records", {
  token: rec.token,
  cuerpo: {
    vehiculo: vehiculo.data.id, mecanico: meca.id, fecha_entrada: "2026-11-12",
    problema: "Ruido en el motor", estado: "recibida",
  },
});
comprobar(orden.status === 200, "recepción crea orden asignada a un mecánico");

const ordenAjena = await api("POST", "/api/collections/ordenes/records", {
  token: rec.token,
  cuerpo: {
    vehiculo: vehiculo.data.id, mecanico: otroMeca.id, fecha_entrada: "2026-11-12",
    problema: "Frenos", estado: "recibida",
  },
});
comprobar(ordenAjena.status === 200, "recepción crea orden de otro mecánico");

// 3. Existencias y precio fijado en el servidor.
const uso = await api("POST", "/api/collections/orden_repuestos/records", {
  token: rec.token,
  cuerpo: { orden: orden.data.id, repuesto: repuesto.data.id, cantidad: 2, precio_unit: 1 },
});
comprobar(uso.status === 200, "usar 2 repuestos en la orden");
comprobar(uso.data?.precio_unit === 12.5, "precio_unit se fija desde el repuesto (ignora el 1 enviado)");

let r1 = await api("GET", `/api/collections/repuestos/records/${repuesto.data.id}`, { token: rec.token });
comprobar(r1.data.existencias === 3, "existencias bajan de 5 a 3");

const demasiados = await api("POST", "/api/collections/orden_repuestos/records", {
  token: rec.token,
  cuerpo: { orden: orden.data.id, repuesto: repuesto.data.id, cantidad: 10 },
});
comprobar(demasiados.status === 400, "rechaza usar más existencias de las que hay");

const borrado = await api("DELETE", `/api/collections/orden_repuestos/records/${uso.data.id}`, { token: rec.token });
comprobar(borrado.status === 204, "recepción quita el repuesto de la orden");
r1 = await api("GET", `/api/collections/repuestos/records/${repuesto.data.id}`, { token: rec.token });
comprobar(r1.data.existencias === 5, "existencias vuelven a 5 al quitar el repuesto");

// 4. Reglas por rol.
const mecaVeOrdenes = await api("GET", "/api/collections/ordenes/records", { token: meca.token });
comprobar(mecaVeOrdenes.status === 200, "mecánico puede leer órdenes");

const trabajoPropio = await api("POST", "/api/collections/trabajos/records", {
  token: meca.token, cuerpo: { orden: orden.data.id, descripcion: "Cambio de aceite", mano_obra: 30 },
});
comprobar(trabajoPropio.status === 200, "mecánico registra trabajo en su orden");

const trabajoAjeno = await api("POST", "/api/collections/trabajos/records", {
  token: meca.token, cuerpo: { orden: ordenAjena.data.id, descripcion: "Frenos", mano_obra: 50 },
});
comprobar(trabajoAjeno.status >= 400, "mecánico no registra trabajo en orden ajena");

const pagoMeca = await api("POST", "/api/collections/pagos/records", {
  token: meca.token, cuerpo: { orden: orden.data.id, monto: 10, fecha: "2026-11-12", metodo: "efectivo" },
});
comprobar(pagoMeca.status >= 400, "mecánico no puede registrar pagos");

const repuestoMeca = await api("POST", "/api/collections/repuestos/records", {
  token: meca.token, cuerpo: { nombre: "X", codigo: `X-${sufijo}`, precio: 1, existencias: 1, minimo: 0 },
});
comprobar(repuestoMeca.status >= 400, "mecánico no puede crear repuestos en inventario");

console.log(fallos === 0 ? "\nTodas las comprobaciones pasaron." : `\n${fallos} comprobación(es) fallaron.`);
process.exitCode = fallos === 0 ? 0 : 1;
