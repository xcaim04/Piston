import { pb } from "../pb.js";
import { esc, ESTADOS, ESTADOS_ABIERTOS, fecha, nombreUsuario, chipEstado } from "../util.js";

// Pantalla de inicio: órdenes abiertas, carga por mecánico y repuestos por agotarse.
export async function render(main) {
  const [ordenes, repuestos] = await Promise.all([
    pb.collection("ordenes").getFullList({ expand: "vehiculo.cliente,mecanico", sort: "-fecha_entrada" }),
    pb.collection("repuestos").getFullList({ sort: "nombre" }),
  ]);

  const abiertas = ordenes.filter((o) => ESTADOS_ABIERTOS.includes(o.estado));
  const porEstado = ESTADOS_ABIERTOS.map((e) => ({ e, n: abiertas.filter((o) => o.estado === e).length }));

  const porMecanico = new Map();
  for (const o of abiertas) {
    const nombre = nombreUsuario(o.expand?.mecanico);
    porMecanico.set(nombre, (porMecanico.get(nombre) || 0) + 1);
  }

  const bajos = repuestos.filter((r) => r.existencias <= r.minimo);

  main.innerHTML = `
    <h1>Inicio</h1>
    <p class="nota">${abiertas.length} orden(es) abiertas. Toca un estado para ver sus órdenes.</p>
    <div class="tiles">
      ${porEstado.map((x) => `
        <a class="tile tile-${x.e}" href="#/ordenes?estado=${x.e}">
          <span class="tile-n">${x.n}</span>
          <span>${esc(ESTADOS[x.e])}</span>
        </a>`).join("")}
    </div>

    <div class="grid dos" style="margin-top:16px">
      <section class="panel">
        <h2>Trabajo por mecánico</h2>
        ${porMecanico.size
          ? `<ul class="lista">${[...porMecanico].map(([n, c]) => `<li><span>${esc(n)}</span><strong>${c}</strong></li>`).join("")}</ul>`
          : `<p class="nota">No hay órdenes abiertas.</p>`}
      </section>
      <section class="panel ${bajos.length ? "panel-alerta" : ""}">
        <h2>Repuestos por agotarse</h2>
        ${bajos.length
          ? `<ul class="lista">${bajos.map((r) => `<li><span>${esc(r.nombre)} <span class="nota">${esc(r.codigo)}</span></span><strong class="bajo">${r.existencias} / mín. ${r.minimo}</strong></li>`).join("")}</ul>
             <p><a class="enlace" href="#/inventario">Ir al inventario</a></p>`
          : `<p class="nota">Todo el inventario está por encima del mínimo.</p>`}
      </section>
    </div>

    <h2>Órdenes abiertas</h2>
    <div class="tabla-wrap"><table>
      <thead><tr><th>Entrada</th><th>Vehículo</th><th>Cliente</th><th>Mecánico</th><th>Estado</th></tr></thead>
      <tbody>${abiertas.map((o) => `
        <tr>
          <td>${fecha(o.fecha_entrada)}</td>
          <td><a class="enlace" href="#/ordenes/${o.id}">${esc(o.expand?.vehiculo?.matricula)}</a></td>
          <td>${esc(o.expand?.vehiculo?.expand?.cliente?.nombre)}</td>
          <td>${esc(nombreUsuario(o.expand?.mecanico))}</td>
          <td>${chipEstado(o.estado)}</td>
        </tr>`).join("") || `<tr><td colspan="5" class="nota">Sin órdenes abiertas.</td></tr>`}
      </tbody>
    </table></div>
  `;
}
