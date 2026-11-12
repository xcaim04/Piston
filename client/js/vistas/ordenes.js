import { pb } from "../pb.js";
import { esc, errorTexto, fecha, aviso, hoy, dinero, nombreUsuario, ESTADOS, METODOS } from "../util.js";

// Órdenes: lista con filtros, alta, y detalle con trabajos, repuestos, pagos y saldo.
export async function render(main, id) {
  if (id === "nueva") return nueva(main);
  return id ? detalle(main, id) : lista(main);
}

function filtrosDeHash() {
  return new URLSearchParams(location.hash.split("?")[1] || "");
}

async function lista(main) {
  const params = filtrosDeHash();
  const estado = params.get("estado") || "";
  const mecanico = params.get("mecanico") || "";

  const partes = [];
  const valores = {};
  if (estado) { partes.push("estado = {:estado}"); valores.estado = estado; }
  if (mecanico) { partes.push("mecanico = {:mecanico}"); valores.mecanico = mecanico; }

  const [ordenes, mecanicos] = await Promise.all([
    pb.collection("ordenes").getFullList({
      filter: partes.length ? pb.filter(partes.join(" && "), valores) : "",
      expand: "vehiculo.cliente,mecanico",
      sort: "-fecha_entrada",
    }),
    pb.collection("users").getFullList({ filter: "rol = 'mecanico'", sort: "nombre" }),
  ]);

  main.innerHTML = `
    <div class="linea" style="justify-content:space-between">
      <h1>Órdenes</h1>
      <a class="enlace" href="#/ordenes/nueva"><button type="button">Nueva orden</button></a>
    </div>
    <form id="filtros" class="linea">
      <label>Estado
        <select name="estado">
          <option value="">Todos</option>
          ${Object.entries(ESTADOS).map(([v, t]) => `<option value="${v}" ${v === estado ? "selected" : ""}>${esc(t)}</option>`).join("")}
        </select>
      </label>
      <label>Mecánico
        <select name="mecanico">
          <option value="">Todos</option>
          ${mecanicos.map((m) => `<option value="${m.id}" ${m.id === mecanico ? "selected" : ""}>${esc(nombreUsuario(m))}</option>`).join("")}
        </select>
      </label>
      <button type="submit">Filtrar</button>
    </form>
    <div class="tabla-wrap"><table>
      <thead><tr><th>Entrada</th><th>Vehículo</th><th>Cliente</th><th>Mecánico</th><th>Estado</th></tr></thead>
      <tbody>${ordenes.map((o) => `
        <tr>
          <td>${fecha(o.fecha_entrada)}</td>
          <td><a class="enlace" href="#/ordenes/${o.id}">${esc(o.expand?.vehiculo?.matricula)}</a></td>
          <td>${esc(o.expand?.vehiculo?.expand?.cliente?.nombre)}</td>
          <td>${esc(nombreUsuario(o.expand?.mecanico))}</td>
          <td>${esc(ESTADOS[o.estado])}</td>
        </tr>`).join("") || `<tr><td colspan="5" class="nota">Sin órdenes con ese filtro.</td></tr>`}
      </tbody>
    </table></div>`;

  document.getElementById("filtros").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const q = new URLSearchParams();
    if (f.get("estado")) q.set("estado", f.get("estado"));
    if (f.get("mecanico")) q.set("mecanico", f.get("mecanico"));
    const texto = q.toString();
    location.hash = texto ? `#/ordenes?${texto}` : "#/ordenes";
  });
}

async function nueva(main) {
  const [vehiculos, mecanicos] = await Promise.all([
    pb.collection("vehiculos").getFullList({ expand: "cliente", sort: "matricula" }),
    pb.collection("users").getFullList({ filter: "rol = 'mecanico'", sort: "nombre" }),
  ]);

  main.innerHTML = `
    <p><a class="enlace" href="#/ordenes">← Órdenes</a></p>
    <h1>Nueva orden de servicio</h1>
    <form id="nueva" class="grid" style="max-width:520px">
      <label>Vehículo
        <select name="vehiculo" required>
          <option value="">Elegir…</option>
          ${vehiculos.map((v) => `<option value="${v.id}" data-km="${v.km ?? ""}">${esc(v.matricula)} — ${esc(v.marca)} ${esc(v.modelo)} (${esc(v.expand?.cliente?.nombre)})</option>`).join("")}
        </select>
      </label>
      <label>Mecánico asignado
        <select name="mecanico" required>
          <option value="">Elegir…</option>
          ${mecanicos.map((m) => `<option value="${m.id}">${esc(nombreUsuario(m))}</option>`).join("")}
        </select>
      </label>
      <label>Problema que reporta el cliente <textarea name="problema" required></textarea></label>
      <label>Kilometraje de entrada <input name="km_entrada" type="number" min="0" inputmode="numeric"></label>
      <button type="submit">Registrar orden</button>
    </form>
    <p id="msg" role="status"></p>`;

  const selVehiculo = main.querySelector('select[name="vehiculo"]');
  const inputKm = main.querySelector('input[name="km_entrada"]');
  // Al elegir vehículo se propone su último kilometraje.
  selVehiculo.addEventListener("change", () => {
    const km = selVehiculo.selectedOptions[0]?.dataset.km;
    inputKm.value = km || "";
  });

  document.getElementById("nueva").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    try {
      const orden = await pb.collection("ordenes").create({
        vehiculo: f.vehiculo,
        mecanico: f.mecanico,
        problema: f.problema,
        km_entrada: f.km_entrada ? Number(f.km_entrada) : null,
        fecha_entrada: hoy(),
        estado: "recibida",
      });
      // El vehículo guarda el último kilometraje con el que llegó.
      if (f.km_entrada) await pb.collection("vehiculos").update(f.vehiculo, { km: Number(f.km_entrada) });
      location.hash = `#/ordenes/${orden.id}`;
    } catch (err) {
      aviso(document.getElementById("msg"), errorTexto(err));
    }
  });
}

async function detalle(main, id) {
  const orden = await pb.collection("ordenes").getOne(id, { expand: "vehiculo.cliente,mecanico" });
  const [trabajos, usados, pagos, repuestos] = await Promise.all([
    pb.collection("trabajos").getFullList({ filter: pb.filter("orden = {:id}", { id }), sort: "created" }),
    pb.collection("orden_repuestos").getFullList({ filter: pb.filter("orden = {:id}", { id }), expand: "repuesto", sort: "created" }),
    pb.collection("pagos").getFullList({ filter: pb.filter("orden = {:id}", { id }), sort: "fecha" }),
    pb.collection("repuestos").getFullList({ sort: "nombre" }),
  ]);

  const manoObra = trabajos.reduce((s, t) => s + t.mano_obra, 0);
  const materiales = usados.reduce((s, r) => s + r.cantidad * r.precio_unit, 0);
  const total = manoObra + materiales;
  const pagado = pagos.reduce((s, p) => s + p.monto, 0);
  const saldo = total - pagado;
  const cancelada = orden.estado === "cancelada";
  const v = orden.expand?.vehiculo;

  main.innerHTML = `
    <p><a class="enlace" href="#/ordenes">← Órdenes</a></p>
    <h1>Orden ${esc(v?.matricula)} — ${esc(v?.marca)} ${esc(v?.modelo)}</h1>
    <p class="nota">Cliente: ${esc(v?.expand?.cliente?.nombre)} · Mecánico: ${esc(nombreUsuario(orden.expand?.mecanico))} · Entrada: ${fecha(orden.fecha_entrada)}${orden.km_entrada ? ` · Km: ${orden.km_entrada}` : ""}</p>
    <p><strong>Problema:</strong> ${esc(orden.problema)}</p>

    <section class="panel">
      <form id="estado" class="linea">
        <label>Estado
          <select name="estado">
            ${Object.entries(ESTADOS).map(([k, t]) => `<option value="${k}" ${k === orden.estado ? "selected" : ""}>${esc(t)}</option>`).join("")}
          </select>
        </label>
        <button type="submit">Actualizar estado</button>
      </form>
      <p id="msg-estado" role="status"></p>
      ${cancelada && pagado > 0 ? `<p class="bajo">Orden cancelada con pagos registrados por ${dinero(pagado)}. Revisar devolución.</p>` : ""}
    </section>

    <div class="grid dos" style="margin-top:16px">
      <section class="panel">
        <h2>Resumen</h2>
        <p>Mano de obra: ${dinero(manoObra)}</p>
        <p>Repuestos: ${dinero(materiales)}</p>
        <p><strong>Total: ${dinero(total)}</strong></p>
        <p>Pagado: ${dinero(pagado)}</p>
        <p class="cifra">${saldo > 0 ? "Saldo: " : "Saldado"}${saldo > 0 ? dinero(saldo) : ""}</p>
      </section>
    </div>

    <h2>Trabajos realizados</h2>
    <div class="tabla-wrap"><table>
      <thead><tr><th>Descripción</th><th class="num">Mano de obra</th><th></th></tr></thead>
      <tbody>${trabajos.map((t) => `
        <tr><td>${esc(t.descripcion)}</td><td class="num">${dinero(t.mano_obra)}</td>
          <td><button type="button" class="peligro" data-borrar="trabajos:${t.id}">Quitar</button></td></tr>`).join("")
        || `<tr><td colspan="3" class="nota">Sin trabajos.</td></tr>`}
      </tbody>
    </table></div>
    <form id="nuevo-trabajo" class="linea">
      <label>Descripción <input name="descripcion" required placeholder="Cambio de aceite"></label>
      <label>Mano de obra <input name="mano_obra" type="number" min="0" step="0.01" required></label>
      <button type="submit">Agregar trabajo</button>
    </form>

    <h2>Repuestos usados</h2>
    <div class="tabla-wrap"><table>
      <thead><tr><th>Repuesto</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Subtotal</th><th></th></tr></thead>
      <tbody>${usados.map((r) => `
        <tr><td>${esc(r.expand?.repuesto?.nombre)}</td><td class="num">${r.cantidad}</td>
          <td class="num">${dinero(r.precio_unit)}</td><td class="num">${dinero(r.cantidad * r.precio_unit)}</td>
          <td><button type="button" class="peligro" data-borrar="orden_repuestos:${r.id}">Quitar</button></td></tr>`).join("")
        || `<tr><td colspan="5" class="nota">Sin repuestos.</td></tr>`}
      </tbody>
    </table></div>
    <form id="nuevo-repuesto" class="linea">
      <label>Repuesto
        <select name="repuesto" required>
          <option value="">Elegir…</option>
          ${repuestos.map((r) => `<option value="${r.id}">${esc(r.nombre)} (${esc(r.codigo)}) — ${r.existencias} en existencia</option>`).join("")}
        </select>
      </label>
      <label>Cantidad <input name="cantidad" type="number" min="1" value="1" required></label>
      <button type="submit">Agregar repuesto</button>
    </form>
    <p id="msg-repuesto" role="status"></p>

    <h2>Pagos</h2>
    <div class="tabla-wrap"><table>
      <thead><tr><th>Fecha</th><th>Método</th><th class="num">Monto</th><th></th></tr></thead>
      <tbody>${pagos.map((p) => `
        <tr><td>${fecha(p.fecha)}</td><td>${esc(METODOS[p.metodo] || "")}</td><td class="num">${dinero(p.monto)}</td>
          <td><button type="button" class="peligro" data-borrar="pagos:${p.id}">Quitar</button></td></tr>`).join("")
        || `<tr><td colspan="4" class="nota">Sin pagos.</td></tr>`}
      </tbody>
    </table></div>
    <form id="nuevo-pago" class="linea">
      <label>Monto <input name="monto" type="number" min="0.01" step="0.01" required></label>
      <label>Fecha <input name="fecha" type="date" value="${hoy()}" required></label>
      <label>Método
        <select name="metodo">
          ${Object.entries(METODOS).map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join("")}
        </select>
      </label>
      <button type="submit">Registrar pago</button>
    </form>
    <p id="msg-pago" role="status"></p>`;

  const aviso_ = (sel, txt, tipo) => aviso(document.getElementById(sel), txt, tipo);

  document.getElementById("estado").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const estado = new FormData(ev.target).get("estado");
    const cambios = { estado };
    // Al entregar se registra la fecha de entrega, que usa el reporte de facturación.
    if (estado === "entregada" && !orden.fecha_entrega) cambios.fecha_entrega = hoy();
    try {
      await pb.collection("ordenes").update(id, cambios);
      await render(main, id);
    } catch (err) {
      aviso_("msg-estado", errorTexto(err));
    }
  });

  document.getElementById("nuevo-trabajo").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    try {
      await pb.collection("trabajos").create({ orden: id, descripcion: f.descripcion, mano_obra: Number(f.mano_obra) });
      await render(main, id);
    } catch (err) {
      aviso_("nuevo-trabajo", errorTexto(err));
    }
  });

  document.getElementById("nuevo-repuesto").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    try {
      // El servidor fija el precio y descuenta existencias (ver pb_hooks/existencias.pb.js).
      await pb.collection("orden_repuestos").create({ orden: id, repuesto: f.repuesto, cantidad: Number(f.cantidad) });
      await render(main, id);
    } catch (err) {
      aviso_("msg-repuesto", errorTexto(err));
    }
  });

  document.getElementById("nuevo-pago").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    try {
      await pb.collection("pagos").create({ orden: id, monto: Number(f.monto), fecha: f.fecha, metodo: f.metodo });
      await render(main, id);
    } catch (err) {
      aviso_("msg-pago", errorTexto(err));
    }
  });

  for (const boton of main.querySelectorAll("[data-borrar]")) {
    boton.addEventListener("click", async () => {
      if (!confirm("¿Quitar este registro?")) return;
      const [coleccion, reg] = boton.dataset.borrar.split(":");
      try {
        await pb.collection(coleccion).delete(reg);
        await render(main, id);
      } catch (err) {
        alert(errorTexto(err));
      }
    });
  }
}
