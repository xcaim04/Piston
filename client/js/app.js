import { pb } from "./pb.js";

const app = document.getElementById("app");
const usuario = document.getElementById("usuario");
const salir = document.getElementById("salir");

function mostrarLogin(mensaje = "") {
  usuario.textContent = "";
  salir.hidden = true;
  app.innerHTML = `
    <form id="login" class="tarjeta">
      <h1>Iniciar sesión</h1>
      <label>Correo <input name="email" type="email" required autocomplete="username"></label>
      <label>Contraseña <input name="password" type="password" required autocomplete="current-password"></label>
      <p class="error" role="alert">${mensaje}</p>
      <button type="submit">Entrar</button>
    </form>`;

  document.getElementById("login").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const { email, password } = Object.fromEntries(new FormData(ev.target));
    try {
      await pb.collection("users").authWithPassword(email, password);
      mostrarInicio();
    } catch {
      mostrarLogin("Correo o contraseña incorrectos.");
    }
  });
}

function mostrarInicio() {
  const { record } = pb.authStore;
  usuario.textContent = `${record.nombre || record.email} (${record.rol})`;
  salir.hidden = false;
  // Pantallas pendientes: ver web/PLAN.md, fase 6.
  app.innerHTML = `<p class="tarjeta">Sesión iniciada. Las pantallas se añaden en la fase 6.</p>`;
}

salir.addEventListener("click", () => {
  pb.authStore.clear();
  mostrarLogin();
});

if (pb.authStore.isValid) {
  mostrarInicio();
} else {
  mostrarLogin();
}
