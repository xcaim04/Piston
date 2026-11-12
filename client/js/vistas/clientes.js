import { pb } from "../pb.js";
import { esc, errorTexto, fecha, aviso, chipEstado, km } from "../util.js";

// Clientes: lista con búsqueda y alta; ficha con datos, vehículos e historial.
export async function render(main, id) {
  return id ? ficha(main, id) : lista(main);
}

async function lista(main) {
  const q = new URLSearchParams(location.hash.split("?")[1] || "").get("q") || "";
  const filtro = q ? pb.filter("nombre ~ {:q} || telefono ~ {:q}", { q }) : "";
  const clientes = await pb.collection("clientes").getFullList({ filter: filtro, sort: "nombre" });

  main.innerHTML = `
    <h1>Clientes</h1>
    <form id="buscar" class="linea">
      <label>Buscar por nombre o teléfono <input name="q" value="${esc(q)}"></label>
      <button type="submit">Buscar</button>
    </form>
    <div class="tabla-wrap"><table>
      <thead><tr><th>Nombre</th><th>Teléfono</th><th>Dirección</th></tr></thead>
      <tbody>${clientes.map((c) => `
        <tr>
          <td><a class="enlace" href="#/clientes/${c.id}">${esc(c.nombre)}</a></td>
          <td>${esc(c.telefono)}</td>
          <td>${esc(c.direccion)}</td>
        </tr>`).join("") || `<tr><td colspan="3" class="nota">Sin resultados.</td></tr>`}
      </tbody>
    </table></div>

    <section class="panel">
      <h2>Nuevo cliente</h2>
      <form id="nuevo" class="linea">
        <label>Nombre <input name="nombre" required></label>
        <label>Teléfono <input name="telefono" required></label>
        <label>Dirección <input name="direccion"></label>
        <button type="submit">Guardar</button>
      </form>
      <p id="msg" role="status"></p>
    </section>`;

  document.getElementById("buscar").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const valor = new FormData(ev.target).get("q").trim();
    location.hash = valor ? `#/clientes?q=${encodeURIComponent(valor)}` : "#/clientes";
  });

  document.getElementById("nuevo").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const datos = Object.fromEntries(new FormData(ev.target));
    try {
      const creado = await pb.collection("clientes").create(datos);
      location.hash = `#/clientes/${creado.id}`;
    } catch (err) {
      aviso(document.getElementById("msg"), errorTexto(err));
    }
  });
}

async function ficha(main, id) {
  const cliente = await pb.collection("clientes").getOne(id);
  const vehiculos = await pb.collection("vehiculos").getFullList({
    filter: pb.filter("cliente = {:id}", { id }),
    sort: "marca,modelo",
  });
  // Historial del cliente: todas sus órdenes, a través de sus vehículos.
  const historial = await pb.collection("ordenes").getFullList({
    filter: pb.filter("vehiculo.cliente = {:id}", { id }),
    expand: "vehiculo",
    sort: "-fecha_entrada",
  });

  main.innerHTML = `
    <p><a class="enlace" href="#/clientes">← Clientes</a></p>
    <h1>${esc(cliente.nombre)}</h1>

    <section class="panel">
      <h2>Datos</h2>
      <form id="editar-cliente" class="linea">
        <label>Nombre <input name="nombre" value="${esc(cliente.nombre)}" required></label>
        <label>Teléfono <input name="telefono" value="${esc(cliente.telefono)}" required></label>
        <label>Dirección <input name="direccion" value="${esc(cliente.direccion)}"></label>
        <button type="submit">Guardar cambios</button>
      </form>
      <p id="msg-cliente" role="status"></p>
    </section>

    <h2>Vehículos</h2>
    <div class="tabla-wrap"><table>
      <thead><tr><th>Matrícula</th><th>Vehículo</th><th>Año</th><th class="num">Km</th></tr></thead>
      <tbody>${vehiculos.map((v) => `
        <tr>
          <td>${esc(v.matricula)}</td>
          <td>${esc(v.marca)} ${esc(v.modelo)}</td>
          <td>${esc(v.anio)}</td>
          <td class="num">${km(v.km)}</td>
        </tr>`).join("") || `<tr><td colspan="4" class="nota">Sin vehículos registrados.</td></tr>`}
      </tbody>
    </table></div>

    <section class="panel">
      <h2>Agregar vehículo</h2>
      <form id="nuevo-vehiculo" class="linea">
        <label>Matrícula <input name="matricula" required></label>
        <label>Marca <input name="marca" required></label>
        <label>Modelo <input name="modelo" required></label>
        <label>Año <input name="anio" type="number" min="1950" max="2100"></label>
        <label>Km <input name="km" type="number" min="0"></label>
        <button type="submit">Agregar</button>
      </form>
      <p id="msg-vehiculo" role="status"></p>
    </section>

    <h2>Historial de servicios</h2>
    <div class="tabla-wrap"><table>
      <thead><tr><th>Entrada</th><th>Vehículo</th><th>Problema</th><th>Estado</th></tr></thead>
      <tbody>${historial.map((o) => `
        <tr>
          <td>${fecha(o.fecha_entrada)}</td>
          <td><a class="enlace" href="#/ordenes/${o.id}">${esc(o.expand?.vehiculo?.matricula)}</a></td>
          <td>${esc(o.problema)}</td>
          <td>${chipEstado(o.estado)}</td>
        </tr>`).join("") || `<tr><td colspan="4" class="nota">Sin servicios todavía.</td></tr>`}
      </tbody>
    </table></div>`;

  document.getElementById("editar-cliente").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      await pb.collection("clientes").update(id, Object.fromEntries(new FormData(ev.target)));
      aviso(document.getElementById("msg-cliente"), "Guardado.", "ok");
    } catch (err) {
      aviso(document.getElementById("msg-cliente"), errorTexto(err));
    }
  });

  document.getElementById("nuevo-vehiculo").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const datos = Object.fromEntries(new FormData(ev.target));
    try {
      await pb.collection("vehiculos").create({ ...datos, cliente: id });
      await render(main, id); // recarga la ficha con el vehículo nuevo
    } catch (err) {
      aviso(document.getElementById("msg-vehiculo"), errorTexto(err));
    }
  });
}
