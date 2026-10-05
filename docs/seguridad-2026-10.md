# Revisión de seguridad y migraciones — octubre 2026

## Lo que se corrigió

| Hallazgo | Riesgo | Arreglo |
|---|---|---|
| 11 funciones sin `search_path` fijo | Alguien con permiso de crear objetos en otro esquema podría cambiar lo que ejecutan | `066_seguridad_funciones.sql`: todas con `search_path = public` |
| Funciones con privilegios (SECURITY DEFINER) llamables sin sesión por `/rest/v1/rpc` | Llamadas anónimas a funciones internas | Sin sesión no se ejecuta ninguna función (ni las futuras); las de trigger tampoco se pueden llamar por la API con sesión |
| `actualizarOperario` y `actualizarEstadoOperario` (acciones de servidor con la clave de administrador) no revisaban que el operario fuera de la finca | El dueño de una finca podía cambiar cargo, pago o estado de **cualquier** usuario si conocía su id | Ahora exigen que el operario sea trabajador de esa finca |
| El cliente con la clave de administrador podía llegar al navegador por un import equivocado | Exponer la clave `service_role` | `src/lib/supabase/admin.ts` lleva `import 'server-only'`: el build falla si se importa en el cliente |
| La carpeta de migraciones no tenía la base inicial (fincas, perfiles, membresías, inventario, animales…) | No se podía reconstruir la base desde el repositorio | `001_base.sql` reconstruido desde el catálogo, idempotente, sin las columnas que agregan migraciones posteriores |

Se probó cada cambio en transacciones que se deshacen, ejecutando como usuario
real: producción del día (y sus triggers de inventario y consumo), venta de
aves, finca nueva (membresía automática), tareas que se repiten y el recálculo
del stock de alimento.

## Lo que queda (decisiones del dueño)

1. **Protección contra contraseñas filtradas** (Supabase → Authentication →
   Providers → Email → *Leaked password protection*). Revisa las contraseñas
   contra HaveIBeenPwned. Se activa desde el panel; no se cambió por ser un ajuste
   de la cuenta.
2. **Registro sin verificar el correo**: `registrarCuenta` crea cuentas ya
   confirmadas (`email_confirm: true`). Es cómodo, pero cualquiera puede abrir una
   cuenta con un correo ajeno. Opción: pedir confirmación por correo.
3. **`es_miembro_finca` sigue ejecutable sin sesión** (aviso del linter que queda
   a propósito): la usan políticas antiguas que aplican a todos los roles; sin
   permiso, esas consultas darían error en lugar de no devolver nada. Sin sesión
   siempre responde `false`, así que no revela datos. Si más adelante todas las
   políticas pasan a `TO authenticated`, se le puede quitar.
4. **Contraseñas temporales de operarios** se muestran una vez al invitarlos:
   conviene pedirles cambiarla al primer ingreso.

## Migraciones

- `supabase/migrations` va de `001_base.sql` a `066_seguridad_funciones.sql` y
  reproduce la base en orden. En el historial de Supabase algunas versiones
  aparecen repetidas (se reintentaron al aplicarlas); los archivos son la fuente.
- Las semillas de las guías (Hy-Line Brown y Lohmann Brown-Classic) están en
  `060_referencias_lineas.sql`; las fases de Hy-Line en `062_fases_alimento.sql`.
