# Plan de acción — Versión web "El Pistón"

Entrega original: viernes 6 de noviembre de 2026, 23:59 (ya vencida; confirmar con el profesor).

## Estructura

```
El Piston/
├── web/
│   ├── PLAN.md
│   ├── README.md              (decisiones de diseño + cómo ejecutar)
│   ├── capturas/              (capturas de la app en uso)
│   ├── server/                (PocketBase)
│   │   ├── pb_migrations/     (colecciones, relaciones, reglas)
│   │   └── pb_hooks/          (control de existencias)
│   └── client/                (HTML + CSS + JS, SDK pocketbase)
└── movil/                     (Flutter, versión posterior)
```

## Fases

1. **Entorno** — Instalar el binario de PocketBase (no instalado todavía; la descarga fue bloqueada) y verificar que `pocketbase serve` arranca.
2. **Servidor: esquema** — Colecciones y relaciones (ver abajo). Migración `001_esquema.js`.
3. **Servidor: reglas de acceso** — Por rol: `recepcion` y `mecanico`.
4. **Servidor: integridad** — Hook: al registrar un repuesto en una orden, bajan las existencias; al quitarlo, se devuelven. Rechaza si no hay suficientes.
5. **Cliente: base** — Login, layout con navegación, cliente del SDK en `js/pb.js`.
6. **Cliente: pantallas** — Ver lista abajo.
7. **Cliente: reportes** — Los seis datos que pide el dueño.
8. **Pruebas manuales** — Flujo completo de una orden: cliente → vehículo → orden → trabajos → repuestos → pagos parciales → entrega.
9. **Entrega** — README, capturas, repositorio en GitHub.

## Modelo de datos

| Colección   | Campos principales                                                                 |
|-------------|------------------------------------------------------------------------------------|
| `users`     | (auth) + `nombre`, `rol` (`recepcion` \| `mecanico`)                               |
| `clientes`  | `nombre`*, `telefono`*, `direccion`                                                |
| `vehiculos` | `cliente`→clientes*, `matricula`* (única), `marca`*, `modelo`*, `anio`, `km`       |
| `repuestos` | `nombre`*, `codigo`* (único), `precio`*, `existencias`*, `minimo` (alerta, por defecto 3) |
| `ordenes`   | `vehiculo`→vehiculos*, `mecanico`→users*, `fecha_entrada`*, `problema`*, `km_entrada`, `estado`*, `fecha_entrega` |
| `trabajos`  | `orden`→ordenes* (cascada), `descripcion`*, `mano_obra`*                           |
| `orden_repuestos` | `orden`→ordenes* (cascada), `repuesto`→repuestos*, `cantidad`*, `precio_unit`* (precio al momento de usar) |
| `pagos`     | `orden`→ordenes* (cascada), `monto`*, `fecha`*, `metodo` (`efectivo`\|`tarjeta`\|`transferencia`) |

\* obligatorio.

**Decisiones:**
- `estado` de la orden: `recibida`, `en_diagnostico`, `en_reparacion`, `lista`, `entregada`, `cancelada`.
- El saldo no se guarda: se calcula como `Σ mano_obra + Σ cantidad×precio_unit − Σ pagos`. Así no puede desincronizarse.
- `precio_unit` se copia al usar el repuesto, para que cambios futuros de precio no alteren órdenes viejas.
- Historial: se obtiene consultando `ordenes` por `vehiculo` o por cliente (a través de `vehiculos`).

## Reglas de acceso

- Todas las colecciones exigen sesión (`@request.auth.id != ""`).
- `recepcion`: crea y edita clientes, vehículos, órdenes, pagos e inventario. Puede borrar.
- `mecanico`: lee todo; edita solo sus órdenes asignadas (`mecanico = @request.auth.id`); crea trabajos y repuestos en esas órdenes. No borra nada.
- Pagos: solo `recepcion` crea y borra.

## Pantallas del cliente

1. **Login**
2. **Inicio** — órdenes abiertas por estado, carga por mecánico, alerta de repuestos bajos.
3. **Clientes** — lista, búsqueda, ficha con vehículos e historial.
4. **Vehículos** — alta/edición ligada a un cliente; ficha con historial.
5. **Órdenes** — lista filtrable por estado y mecánico; nueva orden; detalle con trabajos, repuestos, pagos y saldo.
6. **Inventario** — lista, alta, edición de existencias; repuestos por agotarse resaltados.
7. **Reportes** — facturación por período (desde/hasta) y saldos pendientes por cliente.

## Puntos abiertos — decisiones tomadas

- Se asume una cuenta por persona (los dos mecánicos y la recepcionista). No hay registro público.
- Cancelar una orden no borra nada; solo cambia el estado. Si tenía pagos, se muestra un aviso y se mantienen.
- Factura = total de órdenes `entregada` en el período, por fecha de entrega. (Se necesita fecha de entrega: campo `fecha_entrega` en `ordenes`.)
- Sin modo offline en la versión web.
- Interfaz en español, con botones grandes y contraste alto para uso en taller.

## Riesgos

- Migraciones y hooks no probados todavía: sin el binario de PocketBase no hay forma de comprobar la sintaxis contra la versión instalada. Primer paso al tener el binario: arrancar y revisar la consola.
- Versión del SDK: `pocketbase@0.28.1` (la 0.29.0 es muy reciente).
