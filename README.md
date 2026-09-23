# PetCare

Sistema académico de gestión veterinaria. Separa el cliente React de la API Node/Express y de MySQL; React nunca consulta la base directamente.

## Tecnologías

React 19, Vite, TypeScript, React Router, React Hook Form, Axios, Context API, Bootstrap Grid; Node.js, Express, MySQL, JWT, bcryptjs, CORS y express-validator.

## Puesta en marcha

1. Iniciá MySQL en XAMPP y usá la base PetCare existente. La exportación actual para Railway está en `database/exports/`; ver `database/README.md`. No importarla sobre una base con datos.
2. Copiá `backend/.env.example` como `backend/.env`; completá `JWT_SECRET` y las credenciales MySQL.
3. API: `cd backend && npm install && npm run dev`.
4. Frontend principal: `npm install && npm run dev`.
5. Variante useState: `cd frontend-usestate && npm install && npm run dev`.



## Estructura

- `src/`: frontend principal, rutas, Context y servicios Axios.
- `frontend-usestate/`: navegación con `const [pantalla, setPantalla] = useState(...)`, sin React Router y usando la misma API.
- `backend/src/`: configuración, middleware, controladores y rutas REST.
- `backend/migrations/`: scripts SQL existentes (no ejecutados por la refactorización).
- `backend/src/repositories/`: persistencia de usuarios y catálogo de roles.
- `src/auth/`: decisiones de navegación usando el tipo recibido en la sesión.
- `docs/REFACTOR.md`: informe, verificación y preparación de despliegue.

## API

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/api/auth/register` | Registro de cliente |
| POST | `/api/auth/login` | Inicio de sesión/JWT |
| GET | `/api/auth/me` | Usuario autenticado |
| GET/POST/DELETE | `/api/mascotas` | Mascotas del cliente |
| GET/POST | `/api/turnos` | Consultar/solicitar turnos |
| GET | `/api/especies`, `/api/veterinarios` | Catálogos del formulario |
| GET | `/api/admin/resumen` | Métricas administrativas |

## Roles, seguridad y modelo

Roles: Administrador, Veterinario y Cliente. JWT se envía en `Authorization: Bearer` y el backend comprueba token, rol y propiedad del recurso. Las contraseñas se almacenan con bcrypt; las consultas son parametrizadas y `.env` queda excluido de Git.

Relaciones: `roles → usuarios`; usuarios pueden vincularse a clientes o veterinarios; clientes poseen mascotas; especies poseen razas; mascotas y veterinarios se relacionan con turnos; un turno puede tener una consulta. Los catálogos eliminan valores repetidos (1FN), cada atributo depende de su clave (2FN) y roles/especialidades/razas/estados se separan para eliminar dependencias transitivas (3FN).

## React aplicado

`useState` maneja modales, errores y la segunda navegación; `useEffect` recupera sesión y consulta API; `useForm` valida login, registro, mascotas y turnos. `AuthContext` expone usuario, login y logout. Token y tema se persisten en `localStorage`. La interfaz es responsive y cuenta con tema claro/oscuro.

## OAuth 2.0 / Inicio de sesión con proveedores externos

El frontend principal agrega Google, GitHub, Facebook, Discord, Twitch y X sin quitar
email/contraseña. Authorization Code se procesa en el backend; Google usa OIDC y
Google/GitHub/X incorporan PKCE. La sesión OAuth usa cookie HttpOnly y la local
conserva Bearer. Las identidades externas se guardan en `oauth_accounts`.

Con la base existente ya configurada, ejecutar (no se aplican migraciones automáticamente):

```sh
npm install
cd backend
npm install
npm run dev
```

En otra terminal, desde la raíz: `npm run dev`. Abrir `http://localhost:5173/login`.
En Windows, si PowerShell no resuelve npm correctamente, usar `npm.cmd`.

Completar `backend/.env` siguiendo `backend/.env.example`, sin sobrescribir las
credenciales actuales: variables MySQL, JWT_SECRET, JWT_EXPIRES_IN, CLIENT_URL,
BACKEND_URL y los pares `GOOGLE_`, `GITHUB_`, `FACEBOOK_`, `DISCORD_`, `TWITCH_`,
`TWITTER_` con sufijos `CLIENT_ID`/`CLIENT_SECRET`. Meta requiere además
`FACEBOOK_GRAPH_VERSION`. No se necesita SESSION_SECRET ni secretos en VITE_.

Registrar en cada portal el callback exacto
`http://localhost:3000/api/auth/PROVEEDOR/callback`, con PROVEEDOR igual a
google, github, facebook, discord, twitch o twitter. Al cambiar BACKEND_URL,
actualizar también el registro del proveedor. Si exige HTTPS, usar un dominio HTTPS
de desarrollo y configurar ambas URLs. En producción frontend/API deben ser del mismo sitio.

Los botones sin credenciales quedan deshabilitados. Un email coincidente con una
cuenta existente **no se vincula automáticamente**; se pide usar su acceso habitual.
Usuarios nuevos reciben rol Cliente y contraseña NULL; el segundo ingreso busca
proveedor + ID externo. Las autorizaciones reales quedan pendientes de credenciales.

Guía para estudiar, configuración por proveedor, callbacks y resultados de pruebas:
[docs/OAUTH2_R3.md](docs/OAUTH2_R3.md).

Verificaciones: `npm run build`, `npm run lint`, y en backend `npm run test:oauth`.
Esta última crea una base efímera y requiere permisos CREATE/DROP DATABASE. Los
fallos preexistentes de lint y de la suite demo, y el problema InnoDB del entorno,
se detallan en la guía; no se presentan como corregidos por OAuth.

## Refactorización conservadora

Ver [el informe y la guía de despliegue](docs/REFACTOR.md). `npm test` está configurado para pruebas aisladas, pero las carpetas `tests/` y `backend/tests/` no están presentes en este checkout; no debe interpretarse como una suite validada. La suite histórica `test:oauth` escribe y elimina datos de prueba; `scripts/test-suite.js` requiere una API real y cuentas configuradas. Ninguna forma parte del comando aislado.

La sesión incluye `tipo_usuario` (alias de `usuarios.rol_id`), conserva `rolId` y `rol`, y recibe un catálogo `userTypes` resuelto en el servidor. Bearer y cookies se verifican contra la BD en cada petición protegida.

## Limpieza y traslado a Railway

Se eliminaron backups históricos, archivos sin referencias y builds regenerables después de verificar el funcionamiento. La variante useState se conserva; ejecutar `npm install` dentro de su carpeta para regenerar sus dependencias. Ver [exportación e importación MySQL](database/README.md).
