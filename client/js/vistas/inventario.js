import { pb } from "../pb.js";
import { esc, errorTexto, aviso } from "../util.js";

// Inventario de repuestos: alta, y edición de precio, existencias y mínimo en la misma fila.
export async function render(main) {
  const repuestos = await pb.collection("repuestos").getFullList({ sort: "nombre" });

  main.innerHTML = `
    <h1>Inventario</h1>
    <p class="nota">Las filas en rojo tienen existencias en el mínimo o por debajo.</p>
    <div class="tabla-wrap"><table>
      <thead><tr><th>Nombre</th><th>Código</th><th class="num">Precio</th><th class="num">Existencias</th><th class="num">Mínimo</th><th></th></tr></thead>
      <tbody>${repuestos.map((r) => `
        <tr>
          <td class="${r.existencias <= r.minimo ? "bajo" : ""}">${esc(r.nombre)}</td>
          <td>${esc(r.codigo)}</td>
          <td class="num"><input type="number" min="0" step="0.01" value="${r.precio}" data-campo="precio" aria-label="Precio de ${esc(r.nombre)}" style="width:110px"></td>
          <td class="num"><input type="number" min="0" step="1" value="${r.existencias}" data-campo="existencias" aria-label="Existencias de ${esc(r.nombre)}" style="width:90px"></td>
          <td class="num"><input type="number" min="0" step="1" value="${r.minimo}" data-campo="minimo" aria-label="Mínimo de ${esc(r.nombre)}" style="width:90px"></td>
          <td><button type="button" data-guardar="${r.id}">Guardar</button></td>
        </tr>`).join("") || `<tr><td colspan="6" class="nota">Sin repuestos todavía.</td></tr>`}
      </tbody>
    </table></div>
    <p id="msg-edicion" role="status"></p>

    <section class="panel">
      <h2>Nuevo repuesto</h2>
      <form id="nuevo" class="linea">
        <label>Nombre <input name="nombre" required></label>
        <label>Código <input name="codigo" required></label>
        <label>Precio de venta <input name="precio" type="number" min="0" step="0.01" required></label>
        <label>Existencias <input name="existencias" type="number" min="0" step="1" value="0" required></label>
        <label>Mínimo para alerta <input name="minimo" type="number" min="0" step="1" value="3" required></label>
        <button type="submit">Guardar</button>
      </form>
      <p id="msg-nuevo" role="status"></p>
    </section>`;

  for (const boton of main.querySelectorAll("[data-guardar]")) {
    boton.addEventListener("click", async () => {
      const fila = boton.closest("tr");
      const datos = {};
      for (const campo of fila.querySelectorAll("[data-campo]")) datos[campo.dataset.campo] = Number(campo.value);
      try {
        await pb.collection("repuestos").update(boton.dataset.guardar, datos);
        await render(main);
      } catch (err) {
        aviso(document.getElementById("msg-edicion"), errorTexto(err));
      }
    });
  }

  document.getElementById("nuevo").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    try {
      await pb.collection("repuestos").create({
        nombre: f.nombre,
        codigo: f.codigo,
        precio: Number(f.precio),
        existencias: Number(f.existencias),
        minimo: Number(f.minimo),
      });
      await render(main);
    } catch (err) {
      aviso(document.getElementById("msg-nuevo"), errorTexto(err));
    }
  });
}
