import { pb } from "./pb.js";

export const ESTADOS = {
  recibida: "Recibida",
  en_diagnostico: "En diagnóstico",
  en_reparacion: "En reparación",
  lista: "Lista para entregar",
  entregada: "Entregada",
  cancelada: "Cancelada",
};
export const ESTADOS_ABIERTOS = ["recibida", "en_diagnostico", "en_reparacion", "lista"];
export const METODOS = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" };

// Escapa texto antes de meterlo en innerHTML.
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const dinero = (n) => (Number(n) || 0).toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const hoy = () => new Date().toLocaleDateString("sv"); // AAAA-MM-DD en hora local
export const fecha = (s) => (s ? s.slice(0, 10) : "—");

export const nombreUsuario = (u) => (u ? u.nombre || u.email : "Sin asignar");

// Etiqueta de color para el estado de una orden (colores en css/style.css).
export const chipEstado = (e) => `<span class="chip chip-${esc(e)}">${esc(ESTADOS[e] || e)}</span>`;

export const km = (n) => (n || n === 0 ? Number(n).toLocaleString("es") : "—");

export function errorTexto(err) {
  const datos = err?.response?.data;
  const primero = datos && Object.values(datos)[0];
  return primero?.message || err?.response?.message || err?.message || "Error inesperado.";
}

// Totales por orden: mano de obra, repuestos, pagado y saldo.
// Una sola consulta por colección; el cálculo es el del PLAN (sección Modelo de datos).
export async function totalesPorOrden() {
  const [trabajos, repuestos, pagos] = await Promise.all([
    pb.collection("trabajos").getFullList({ fields: "orden,mano_obra" }),
    pb.collection("orden_repuestos").getFullList({ fields: "orden,cantidad,precio_unit" }),
    pb.collection("pagos").getFullList({ fields: "orden,monto" }),
  ]);
  const mapa = new Map();
  const de = (id) => {
    if (!mapa.has(id)) mapa.set(id, { mano: 0, rep: 0, pagado: 0 });
    return mapa.get(id);
  };
  for (const t of trabajos) de(t.orden).mano += t.mano_obra;
  for (const r of repuestos) de(r.orden).rep += r.cantidad * r.precio_unit;
  for (const p of pagos) de(p.orden).pagado += p.monto;

  return {
    de(id) {
      const v = mapa.get(id) || { mano: 0, rep: 0, pagado: 0 };
      const total = v.mano + v.rep;
      return { ...v, total, saldo: total - v.pagado };
    },
  };
}

// Mensaje de estado dentro de un contenedor (error o confirmación).
export function aviso(el, texto, tipo = "error") {
  el.textContent = texto;
  el.className = tipo === "error" ? "error" : "ok";
}
