# El Pistón — versión web

Sistema web para el taller "El Pistón": clientes, vehículos, órdenes de servicio, inventario, pagos y reportes.

- `server/`: PocketBase, con el esquema (`pb_migrations/`), las reglas de acceso y el control de existencias (`pb_hooks/`).
- `client/`: HTML, CSS y JavaScript sin paso de compilación, con el SDK `pocketbase@0.28.1` desde jsDelivr.

Diseño completo y fases en [`PLAN.md`](PLAN.md).

## Decisiones de diseño

- **Dos roles.** `recepcion` gestiona clientes, vehículos, órdenes, pagos e inventario. `mecanico` lee todo, edita solo sus órdenes asignadas y registra trabajos y repuestos en ellas. Las reglas están en el servidor; la interfaz no es la barrera.
- **Saldo calculado, no guardado.** `saldo = Σ mano de obra + Σ cantidad × precio unitario − Σ pagos`. Así no puede desincronizarse.
- **Precio del momento.** Al usar un repuesto, el servidor copia su precio en `orden_repuestos.precio_unit`. Cambios de precio posteriores no alteran órdenes viejas.
- **Stock controlado en el servidor.** Usar un repuesto descuenta existencias y rechaza si no hay suficientes. Quitarlo las devuelve.
- **Alerta de repuestos bajos.** Cada repuesto tiene un mínimo (por defecto 3). Aparece en la pantalla de inicio y en el inventario.
- **Cancelar no borra.** Una orden cancelada conserva sus pagos y muestra un aviso si los tiene.
- **Facturación.** Es el total de las órdenes entregadas cuya `fecha_entrega` cae en el período. Al marcar una orden como entregada se fija la fecha si estaba vacía.
- **Kilometraje.** Al crear una orden se guarda el kilometraje de entrada en la orden y en el vehículo.
- **Sin modo sin conexión.** Eso corresponde a la versión móvil.

## Cómo ejecutar

### Servidor

1. Descargar PocketBase desde <https://pocketbase.io/docs/> y colocar el binario en `server/`.
2. Desde `server/`, arrancar el servidor:

   ```
   ./pocketbase serve
   ```

   Las migraciones de `pb_migrations/` se aplican al primer arranque.
3. En el panel de administración (<http://127.0.0.1:8090/_/>), crear al menos un usuario con `rol = recepcion` y uno con `rol = mecanico`. Los campos `nombre` y `rol` están en la colección `users`.

### Cliente

El cliente se sirve como archivos estáticos. Desde `client/`:

```
python3 -m http.server 8080
```

Abrir <http://127.0.0.1:8080>. Si el servidor no está en `http://127.0.0.1:8090`, cambiar la URL en `js/pb.js`.

### Prueba de humo del servidor

Con el servidor corriendo y un superusuario creado (`./pocketbase superuser upsert EMAIL PASS`):

```
cd server
PB_SU_EMAIL=EMAIL PB_SU_PASS=PASS node pruebas/smoke.mjs
```

Crea datos de prueba en la base de desarrollo. Comprueba reglas por rol, el precio fijado en el servidor y el descuento y devolución de existencias.

## Estado

- Servidor: esquema y reglas aplicados sin error con PocketBase 0.40.6; la prueba de humo pasa las 19 comprobaciones.
- Cliente: todas las pantallas recorridas en Chrome con datos de ejemplo; capturas en [`capturas/`](capturas/).
- No se probó todavía con el rol `mecanico` desde la interfaz (sí desde la API, en la prueba de humo).
