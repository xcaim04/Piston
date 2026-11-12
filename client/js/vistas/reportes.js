import { pb } from "../pb.js";
import { esc, fecha, dinero, hoy, totalesPorOrden } from "../util.js";

// Reportes: facturación en un período y saldos pendientes por cliente.
export async function render(main) {
  const hoyStr = hoy();
  const primerDia = hoyStr.slice(0, 8) + "01";
  const desde = new URLSearchParams(location.hash.split("?")[1] || "").get("desde") || primerDia;
  const hasta = new URLSearchParams(location.hash.split("?")[1] || "").get("hasta") || hoyStr;

  const [facturacion, saldos] = await Promise.all([
    facturado(desde, hasta),
    saldosPendientes(),
  ]);

  main.innerHTML = `
    <h1>Reportes</h1>

    <section class="panel">
      <h2>Facturación por período</h2>
      <p class="nota">Suma el total de las órdenes entregadas cuya fecha de entrega cae en el período.</p>
      <form id="periodo" class="linea">
        <label>Desde <input name="desde" type="date" value="${desde}" required></label>
        <label>Hasta <input name="hasta" type="date" value="${hasta}" required></label>
        <button type="submit">Ver</button>
      </form>
      <p class="cifra">${dinero(facturacion.total)}</p>
      <p class="nota">${facturacion.ordenes.length} orden(es) entregadas en el período.</p>
      <div class="tabla-wrap"><table>
        <thead><tr><th>Entrega</th><th>Vehículo</th><th>Cliente</th><th class="num">Total</th></tr></thead>
        <tbody>${facturacion.ordenes.map((o) => `
          <tr>
            <td>${fecha(o.fecha_entrega)}</td>
            <td><a class="enlace" href="#/ordenes/${o.id}">${esc(o.expand?.vehiculo?.matricula)}</a></td>
            <td>${esc(o.expand?.vehiculo?.expand?.cliente?.nombre)}</td>
            <td class="num">${dinero(o.total)}</td>
          </tr>`).join("") || `<tr><td colspan="4" class="nota">Sin facturación en el período.</td></tr>`}
        </tbody>
      </table></div>
    </section>

    <section class="panel" style="margin-top:16px">
      <h2>Saldo pendiente por cliente</h2>
      <div class="tabla-wrap"><table>
        <thead><tr><th>Cliente</th><th class="num">Órdenes con saldo</th><th class="num">Saldo</th></tr></thead>
        <tbody>${saldos.map((s) => `
          <tr><td><a class="enlace" href="#/clientes/${s.id}">${esc(s.nombre)}</a></td>
            <td class="num">${s.ordenes}</td><td class="num">${dinero(s.saldo)}</td></tr>`).join("")
          || `<tr><td colspan="3" class="nota">Ningún cliente debe saldo.</td></tr>`}
        </tbody>
      </table></div>
    </section>`;

  document.getElementById("periodo").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    location.hash = `#/reportes?desde=${f.get("desde")}&hasta=${f.get("hasta")}`;
  });
}

async function facturado(desde, hasta) {
  const ordenes = await pb.collection("ordenes").getFullList({
    filter: pb.filter(
      "estado = {:estado} && fecha_entrega >= {:desde} && fecha_entrega <= {:hasta}",
      { estado: "entregada", desde, hasta: `${hasta} 23:59:59` },
    ),
    expand: "vehiculo.cliente",
    sort: "-fecha_entrega",
  });
  const totales = await totalesPorOrden();
  const conTotal = ordenes.map((o) => ({ ...o, total: totales.de(o.id).total }));
  return { ordenes: conTotal, total: conTotal.reduce((s, o) => s + o.total, 0) };
}

async function saldosPendientes() {
  const ordenes = await pb.collection("ordenes").getFullList({
    filter: pb.filter("estado != {:c}", { c: "cancelada" }),
    expand: "vehiculo.cliente",
  });
  const totales = await totalesPorOrden();
  const porCliente = new Map();
  for (const o of ordenes) {
    const cliente = o.expand?.vehiculo?.expand?.cliente;
    if (!cliente) continue;
    const saldo = totales.de(o.id).saldo;
    if (saldo <= 0.001) continue;
    const fila = porCliente.get(cliente.id) || { id: cliente.id, nombre: cliente.nombre, ordenes: 0, saldo: 0 };
    fila.ordenes += 1;
    fila.saldo += saldo;
    porCliente.set(cliente.id, fila);
  }
  return [...porCliente.values()].sort((a, b) => b.saldo - a.saldo);
}
