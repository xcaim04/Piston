import { pb } from "./pb.js";
import { esc, errorTexto } from "./util.js";
import * as inicio from "./vistas/inicio.js";
import * as clientes from "./vistas/clientes.js";
import * as ordenes from "./vistas/ordenes.js";
import * as inventario from "./vistas/inventario.js";
import * as reportes from "./vistas/reportes.js";

const RUTAS = { inicio, clientes, ordenes, inventario, reportes };

const app = document.getElementById("app");
const usuario = document.getElementById("usuario");
const salir = document.getElementById("salir");
const nav = document.getElementById("nav");

function irA(hash) {
  // Si ya estamos en ese hash no salta el evento hashchange, así que se renderiza a mano.
  if (location.hash === hash) ruta();
  else location.hash = hash;
}

function mostrarLogin(mensaje = "") {
  usuario.textContent = "";
  salir.hidden = true;
  nav.hidden = true;
  app.innerHTML = `
    <form id="login" class="tarjeta">
      <h1>Iniciar sesión</h1>
      <label>Correo <input name="email" type="email" required autocomplete="username"></label>
      <label>Contraseña <input name="password" type="password" required autocomplete="current-password"></label>
      <p class="error" role="alert">${esc(mensaje)}</p>
      <button type="submit">Entrar</button>
    </form>`;

  document.getElementById("login").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const { email, password } = Object.fromEntries(new FormData(ev.target));
    try {
      await pb.collection("users").authWithPassword(email, password);
      mostrarCabecera();
      irA("#/inicio");
    } catch {
      mostrarLogin("Correo o contraseña incorrectos.");
    }
  });
}

function mostrarCabecera() {
  const { record } = pb.authStore;
  usuario.textContent = `${record.nombre || record.email} (${record.rol || "sin rol"})`;
  salir.hidden = false;
  nav.hidden = false;
}

async function ruta() {
  if (!pb.authStore.isValid) return mostrarLogin();
  mostrarCabecera();

  const [seccion, id] = location.hash.replace(/^#\/?/, "").split("?")[0].split("/");
  const nombre = RUTAS[seccion] ? seccion : "inicio";
  for (const a of nav.querySelectorAll("a")) a.classList.toggle("activa", a.dataset.s === nombre);

  app.innerHTML = `<p class="cargando">Cargando…</p>`;
  try {
    await RUTAS[nombre].render(app, id);
  } catch (err) {
    app.innerHTML = `<p class="tarjeta error" role="alert">${esc(errorTexto(err))}</p>`;
  }
}

salir.addEventListener("click", () => {
  pb.authStore.clear();
  irA("#/inicio");
});
window.addEventListener("hashchange", ruta);
ruta();
