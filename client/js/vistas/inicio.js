import { pb } from "../pb.js";
import { esc, ESTADOS, ESTADOS_ABIERTOS, fecha, nombreUsuario } from "../util.js";

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
    <div class="grid dos">
      <section class="panel">
        <h2>Órdenes abiertas: ${abiertas.length}</h2>
        <ul>${porEstado.map((x) => `<li>${esc(ESTADOS[x.e])}: <strong>${x.n}</strong></li>`).join("")}</ul>
      </section>
      <section class="panel">
        <h2>Trabajo por mecánico</h2>
        ${porMecanico.size
          ? `<ul>${[...porMecanico].map(([n, c]) => `<li>${esc(n)}: <strong>${c}</strong> orden(es)</li>`).join("")}</ul>`
          : `<p class="nota">No hay órdenes abiertas.</p>`}
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
          <td>${esc(ESTADOS[o.estado])}</td>
        </tr>`).join("") || `<tr><td colspan="5" class="nota">Sin órdenes abiertas.</td></tr>`}
      </tbody>
    </table></div>

    <h2>Repuestos por agotarse</h2>
    <ul>${bajos.map((r) => `<li class="bajo">${esc(r.nombre)} (${esc(r.codigo)}): ${r.existencias} en existencia, mínimo ${r.minimo}</li>`).join("")
      || `<li class="nota">Todo el inventario está por encima del mínimo.</li>`}</ul>
  `;
}
