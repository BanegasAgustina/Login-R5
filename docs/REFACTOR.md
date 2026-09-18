> Actualización posterior: el usuario validó el funcionamiento y autorizó la limpieza. Se eliminaron `.refactor-baseline`, `src-backups`, builds y archivos sin uso. MySQL volvió a estar disponible y se exportó en modo lectura. El estado actual y los archivos para Railway están en [database/README.md](../database/README.md). Este informe conserva el detalle histórico de la refactorización.

# Informe de refactorización conservadora

Fecha: 18 de septiembre de 2026.

Se mantuvieron React/Vite, la variante useState, Express, MySQL, las URLs, los seis proveedores OAuth y los contratos existentes. No se ejecutaron migraciones ni escrituras sobre MySQL. No se instalaron SDKs de Firebase ni se conectó Firebase Auth. La carpeta no contiene un repositorio Git; se guardó una copia local anterior en `.refactor-baseline/`, excluida de Git, lint y despliegue.

La comprobación de conexión MySQL devolvió `ECONNREFUSED`. Los resultados automatizados de autenticación usan persistencia simulada; no equivalen a una prueba integral contra XAMPP ni a una autorización real con los proveedores.

## 1. Roles hardcodeados encontrados y corregidos

El esquema utilizado por el código es `usuarios.rol_id → roles.id`. No se añadió una columna a MySQL. `tipo_usuario` es un alias de ese ID en la respuesta de la API; se conservan `rolId` y `rol` para los consumidores existentes.

| Archivo | Antes | Ahora |
|---|---|---|
| `backend/src/controllers/authController.js` | Registro asignaba el ID fijo 3 | El repositorio obtiene el ID Cliente del catálogo |
| `backend/src/middleware/auth.js` | Bearer autorizaba usando el rol guardado en JWT; solo cookie reconsultaba BD | Ambos medios recuperan cuenta, estado y tipo vigente; los claims de rol del JWT no autorizan |
| `backend/src/routes/petRoutes.js` | Comparaciones repetidas con nombres; una comparación de rol dentro de SQL | `hasUserType` y claves de política; se preservan condiciones de propiedad y permisos |
| `backend/src/routes/adminRoutes.js` | Guard por nombre y rango 1–3 para edición | Guard centralizado y validación de existencia en `roles`; el listado incluye `u.rol_id`, necesario para precargar la edición |
| `backend/src/services/oauthAccounts.js` | Resolución de Cliente por nombre duplicada | Usa el repositorio de tipos dentro de la misma transacción; conserva resolución por proveedor + ID |
| `src/App.tsx`, `src/components/ProtectedRoute.tsx` | Guards por etiquetas | Comprobación del ID recibido en sesión mediante helper |
| `src/components/Layout.tsx` | Menú por nombres de rol | Mismas entradas, rutas y textos; tipos resueltos por API |
| `src/pages/LoginPage.tsx`, `DashboardPage.tsx`, `AppointmentsPage.tsx` | Comparaciones de nombres repetidas | Helper centralizado; mismas redirecciones y acciones |
| `src/pages/admin/AdminUsersPage.tsx` | Opciones fijas y valores 1, 2, 3 | Opciones desde el nuevo endpoint administrativo `/api/admin/roles` |

`backend/src/auth/userTypes.js` contiene únicamente las claves de política y la correspondencia con los nombres del catálogo heredado. Los IDs se consultan en la BD, no se presuponen. Es compatibilidad con el esquema actual, no una lista de usuarios. El frontend no tiene un mapa de nombres a IDs: recibe `userTypes` con la sesión y compara `tipo_usuario`. La autorización definitiva sigue en el servidor.

Las comprobaciones de rol de las copias históricas `src-backups/`, `backend/src-backups/` y `frontend-usestate/src-backups/` se localizaron y se conservaron como material histórico; no son entradas de ejecución ni se despliegan. Tampoco se cambiaron nombres visibles, validaciones de formularios, estados de turnos, límites de carga o catálogos legítimos de interfaz.

## 2. Archivos movidos / código extraído

No se movieron archivos completos ni se cambiaron las carpetas raíz existentes. Se extrajeron responsabilidades manteniendo los puntos de entrada:

```text
ANTES: backend/src/server.js (aplicación + listener)
AHORA: backend/src/app.js (aplicación Express exportada)
       backend/src/server.js (listener local, misma ruta y comandos)

ANTES: backend/src/controllers/authController.js (SQL + HTTP)
AHORA: backend/src/repositories/userRepository.js (SQL de usuarios)
       backend/src/controllers/authController.js (HTTP y autenticación)

ANTES: authController.js + oauthRoutes.js (firma de sesión repetida)
AHORA: backend/src/auth/session.js (firma compartida)

ANTES: múltiples rutas, páginas y guards (comprobaciones repetidas)
AHORA: backend/src/auth/userTypes.js + src/auth/userTypes.ts
```

No se creó una carpeta `database/schema/` ficticia: esta copia no incluye los SQL originales del esquema y datos. La migración OAuth existente permanece en `backend/migrations/` y no se ejecutó.

## 3. Archivos modificados y nuevos

| Archivos | Motivo |
|---|---|
| `backend/src/controllers/authController.js` | Delegar consultas al repositorio y firmar sesiones con helper compartido |
| `backend/src/middleware/auth.js` | Consultar estado/tipo vigente para Bearer y cookie |
| `backend/src/routes/adminRoutes.js` | Catálogo administrativo, validación real de ID, tipo en listado |
| `backend/src/routes/petRoutes.js` | Centralizar comparaciones preservando filtros y acciones |
| `backend/src/routes/oauthRoutes.js` | Compartir firma de sesión, sin reemplazar flujos OAuth |
| `backend/src/services/oauthAccounts.js` | Reutilizar resolución de Cliente desde BD |
| `backend/src/utils/sanitize.js` | Añadir `tipo_usuario` y catálogo de sesión sin exponer secretos |
| `backend/src/server.js` | Conservar inicio local después de extraer Express |
| `backend/src/routes/uploadRoutes.js` | Configuración común de directorio; crear carpeta al subir, no al importar |
| `backend/src/app.js` **nuevo** | Exportar Express sin abrir puerto; conservar middleware, rutas y errores |
| `backend/src/auth/userTypes.js`, `session.js` **nuevos** | Política central y emisión de sesión |
| `backend/src/repositories/userRepository.js`, `roleRepository.js` **nuevos** | Frontera reemplazable de persistencia para cuentas y tipos |
| `backend/src/config/uploads.js` **nuevo** | Directorio local/persistente configurable |
| `backend/src/config/environment.js` **nuevo**, `database.js` | Extraer carga de entorno común sin cambiar la conexión MySQL |
| `src/App.tsx`, `src/components/ProtectedRoute.tsx`, `Layout.tsx` | Usar helpers de tipos para rutas y navegación |
| `src/pages/LoginPage.tsx`, `DashboardPage.tsx`, `AppointmentsPage.tsx` | Eliminar decisiones por etiquetas repetidas |
| `src/pages/admin/AdminUsersPage.tsx`, `src/services/adminService.ts` | Obtener opciones administrativas desde la API |
| `src/types.ts`, `src/auth/userTypes.ts` **nuevo** | Contrato de sesión y helpers de navegación |
| `frontend-usestate/src/App.jsx`, `frontend-usestate/vite.config.js` **nuevo** | API relativa y proxy local configurable |
| `vite.config.ts` | Reutilizar `BACKEND_URL` para el proxy; conservar fallback local por puerto |
| `package.json`, `backend/package.json`, `frontend-usestate/package.json` | Scripts de backend, tests aislados y build de variante |
| `frontend-usestate/package-lock.json` **nuevo** | Instalación reproducible de la variante |
| `backend/scripts/check-syntax.js` **nuevo** | Comprobar sintaxis ESM del backend sin tocar la BD |
| `backend/tests/auth.test.js`, `tests/userTypes.test.mjs` **nuevos** | Regresiones de autenticación, permisos, registro, OAuth y navegación |
| `backend/scripts/test-suite.js`, `backend/scripts/.env.example` **nuevo** | Quitar credenciales reales hardcodeadas de la suite histórica; requiere variables explícitas |
| `.env.example`, `backend/.env.example` | Documentar producción y directorio persistente opcional |
| `vercel.json`, `backend/vercel.json` **nuevos** | Configuración de proyectos frontend y Express separados |
| `.gitignore`, `.vercelignore` **nuevo**, `backend/.vercelignore` **nuevo** | Excluir secretos, históricos y copia local del despliegue |
| `eslint.config.js` | Excluir artefactos generados y copia local; sin desactivar reglas existentes |
| `README.md`, `docs/OAUTH2_R3.md`, `docs/REFACTOR.md` **nuevo** | Uso actual, informe y límites de validación/despliegue; quitar contraseñas del README |

No se modificaron `.env` reales, valores de conexión MySQL, migraciones, fotos existentes, CSS, assets, implementaciones de los proveedores ni las reglas de validación de login/registro. `dist/` y `frontend-usestate/dist/` son salidas regeneradas por sus builds.

## 4. Estructura final

```text
/
├── src/                         # Frontend principal React/Vite
│   ├── auth/userTypes.ts
│   ├── assets/
│   ├── components/
│   ├── context/
│   ├── hooks/
│   ├── pages/admin/
│   ├── services/
│   ├── styles/
│   ├── utils/
│   ├── App.tsx
│   └── types.ts
├── public/
├── frontend-usestate/
│   ├── src/
│   ├── src-backups/             # Histórico
│   ├── vite.config.js
│   ├── package.json
│   └── package-lock.json
├── backend/
│   ├── src/
│   │   ├── auth/               # Política y sesiones
│   │   ├── config/             # MySQL, OAuth, uploads
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── repositories/       # Usuarios y roles
│   │   ├── routes/
│   │   ├── services/           # OAuth existente
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   ├── migrations/             # SQL existente, no ejecutado
│   ├── scripts/
│   ├── tests/
│   ├── uploads/                # Fotos existentes
│   ├── src-backups/            # Histórico
│   ├── .env.example
│   ├── .vercelignore
│   ├── package.json
│   └── vercel.json
├── tests/
├── docs/
├── src-backups/                 # Histórico
├── .env.example
├── .gitignore
├── .vercelignore
├── package.json
├── vite.config.ts
├── vercel.json
├── server.js                    # Entrada histórica conservada
└── README.md
```

## 5. Variables de entorno (solo nombres)

Aplicación / producción:

```text
VITE_API_URL
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME
JWT_SECRET
JWT_EXPIRES_IN
CLIENT_URL
BACKEND_URL
NODE_ENV
PORT
UPLOADS_DIR
```

`PORT`, `DB_PORT` y `JWT_EXPIRES_IN` conservan sus valores por defecto. `UPLOADS_DIR` es opcional; omitirlo conserva `backend/uploads/`. `VITE_API_URL` puede omitirse en local con el proxy, pero debe apuntar a la API pública en el despliegue separado. No se crearon variables duplicadas `FRONTEND_URL`, `DATABASE_URL` ni variables Firebase sin uso.

Solo para los proveedores que se habiliten:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
FACEBOOK_CLIENT_ID
FACEBOOK_CLIENT_SECRET
FACEBOOK_GRAPH_VERSION
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET
TWITTER_CLIENT_ID
TWITTER_CLIENT_SECRET
```

Solo para ejecutar manualmente la suite histórica con cuentas de prueba:

```text
TEST_API_URL
TEST_ADMIN_EMAIL
TEST_ADMIN_PASSWORD
TEST_VET_EMAIL
TEST_VET_PASSWORD
TEST_CLIENT_EMAIL
TEST_CLIENT_PASSWORD
```

`TEST_API_URL` es opcional si ya se configuró `BACKEND_URL`. No se necesitan estas variables para `npm test` ni para la aplicación. El archivo `backend/scripts/.env.example` documenta sus nombres; hay que exportarlas al entorno o cargarlas explícitamente al ejecutar esa suite.

## 6. Preparación para Firebase como base de datos

`createUserRepository` recibe un adaptador de base y expone `findSessionById`, `findById`, `findActiveByEmail`, `emailExists`, `createClient`, `updateProfile`. El controlador no contiene SQL. `roleRepository` concentra lectura del catálogo, resolución de IDs y validación de existencia. Estos son los puntos de sustitución futuros; conservar los contratos públicos permitirá mantener las pantallas y servicios.

Se preservaron las consultas de mascotas, turnos, consultas y administración en sus rutas. Mover todas esas operaciones, transacciones y fallbacks sin una BD disponible aumentaría el alcance y el riesgo. **La capa de datos completa todavía no es independiente de MySQL.** OAuth conserva sus servicios transaccionales `oauthAccounts` y `oauthFlows`; una migración futura deberá implementar equivalentes de unicidad, consumo único de state y transacciones. No se sustituyó persistencia ni se modificó el esquema.

## 7. Preparación para Firebase Auth

El punto actual de integración está en `backend/src/routes/oauthRoutes.js`, entre la verificación de identidad y la resolución de cuenta:

```text
externalIdentity (proveedor verificado)
  → resolveAccount (cuenta persistida)
  → createSessionToken (sesión PetCare)
  → authMiddleware (tipo/estado vigente desde BD)
```

Una futura integración manual deberá verificar el token de Firebase en el backend y resolver su UID a una cuenta persistida antes de llamar a `createSessionToken`. No aceptar UID/email/tipo afirmados por el navegador. Conservar una vinculación explícita para cuentas existentes; el email coincidente no debe autorizar una unión automática. El lugar de emisión común es `backend/src/auth/session.js`. Google, GitHub, Facebook, Discord, Twitch y X conservan sus adaptadores, callbacks, state, PKCE y OIDC actuales.

## 8. Preparación de Vercel y desarrollo local

Se prepararon **dos proyectos separados**, conservando la estructura del frontend principal en la raíz.

| Configuración | Frontend principal | Backend Express |
|---|---|---|
| Root Directory | `.` | `backend` |
| Framework | Vite | Express |
| Install Command | `npm install` | `npm install` |
| Build Command | `npm run build` | `npm run build` (verifica sintaxis) |
| Output Directory | `dist` | Sin override; salida administrada por Express |
| Entrada | `index.html` / `src/main.tsx` | `src/app.js` |
| Variables | `VITE_API_URL` | Variables de BD, JWT, CLIENT_URL, BACKEND_URL, NODE_ENV; OAuth según proveedores habilitados |

La configuración de Vite incorpora fallback SPA para recargas de rutas. Excluye `/api` y `/uploads` del fallback: una ruta API inexistente no debe responder HTML. En producción separada, configurar `VITE_API_URL` con el origen público de la API y su sufijo `/api`. Publicar primero el backend compatible y luego el frontend. Este valor se incorpora en el build; cambiarlo requiere reconstruir el frontend. Las fotos relativas siguen resolviéndose desde ese origen.

`CLIENT_URL` debe ser el origen público exacto del frontend y `BACKEND_URL` el origen público de la API. Usar HTTPS y frontend/API bajo el mismo sitio (por ejemplo, subdominios de un dominio propio) para conservar las cookies `SameSite=Lax`. Dos proyectos arbitrarios en dominios `vercel.app` distintos no garantizan el funcionamiento de estas cookies. Mantener los callbacks registrados como `BACKEND_URL` seguido de `/api/auth/PROVEEDOR/callback`; no se modificaron sus paths ni la configuración de los portales.

**Límite real: no está listo un despliegue íntegro de producción serverless conservando las fotos actuales.** La exportación Express está preparada, pero la aplicación carga imágenes de hasta 5 MB en disco local y las sirve con `express.static`. Vercel documenta que ese middleware no sirve archivos en su integración Express; además, las Functions limitan el cuerpo a 4.5 MB. No se redujo el límite de la aplicación ni se simuló persistencia con archivos temporales. [Express en Vercel](https://vercel.com/docs/frameworks/backend/express), [límites de Functions](https://vercel.com/docs/functions/limitations).

Para conservar toda la funcionalidad ahora, desplegar el frontend en Vercel y ejecutar el backend con Node en un host con disco persistente y acceso a MySQL. Para trasladar también el backend a Vercel faltan un almacenamiento durable y un flujo de upload compatible con el límite de Functions. También se debe resolver el rate limit de login, que hoy usa memoria de proceso y no comparte contadores entre instancias. Se documentan estos límites en vez de cambiar funcionalidades o agregar servicios externos sin configuración.

XAMPP en localhost no queda accesible automáticamente desde Vercel. El backend remoto necesita acceso de red a la base MySQL existente; no se realizó ninguna migración. No se desplegó ni publicaron dominios durante esta tarea.

Comandos locales conservados:

```sh
# En la raíz
npm install
npm run dev

# En otra terminal
cd backend
npm install
npm run dev

# Variante, en su carpeta
cd frontend-usestate
npm install
npm run dev
```

También se puede iniciar la API desde la raíz con `npm run dev:backend`. `node server.js` conserva la entrada histórica. En PowerShell se verificaron los comandos con `npm.cmd`.

## 9. Verificaciones realizadas

| Verificación | Resultado |
|---|---|
| Instalación raíz/backend/variante | Pasó con `npm.cmd install --ignore-scripts --no-audit --no-fund --offline`; sin actualizar versiones ni añadir SDKs |
| Build frontend principal | Pasó: TypeScript + Vite |
| Build variante useState | Pasó: Vite |
| Backend | Pasó `npm run build`: sintaxis ESM; importación de app y HTTP real en puerto efímero durante tests |
| `npm test` | Pasó: 1 prueba frontend + 13 resultados backend (10 subcasos HTTP, su contenedor y 2 pruebas independientes) |
| Lint global | No pasa: mismos 11 errores y 5 advertencias anteriores, en los mismos archivos y reglas; 6 errores en backups, 5 en frontend activo |
| Imports relativos | 64 archivos fuente examinados; ninguna referencia relativa sin resolver |
| Endpoints | Los 35 endpoints de routers originales se conservan; 1 nuevo endpoint de catálogo; `/api/health` también conservado |
| URLs React | Misma lista de paths que antes |
| CSS / imágenes | Comparación binaria sin cambios |
| Arranque local y foto existente | `/api/health` y un JPEG existente devolvieron 200; no se subieron ni alteraron archivos |
| MySQL real | No disponible: `ECONNREFUSED` en consulta de solo lectura |
| OAuth contra proveedores reales | No realizado; necesita credenciales/configuración de sus portales |
| Vercel remoto | No desplegado; configuración y límites documentados |

Los tests cubren: rol malicioso en login y registro ignorado, IDs de catálogo distintos de 1–3, tipo vigente para Bearer y cookie, cambio de rol con token ya emitido, cuenta inactiva/eliminada, firma inválida, rechazo de credenciales incorrectas, OAuth sin contraseña, CSRF/logout, selección administrativa de roles, permisos clínicos, filtros de propiedad, endpoints OAuth, creación y reingreso de identidad externa, CORS y 404.

No se ejecutó `npm run test:oauth`: crea y elimina una base de prueba y ejecuta SQL de escritura. No se ejecutó la suite histórica `test-suite.js`: requiere API/BD operativa y cuentas reales de prueba; ahora recibe sus credenciales por entorno. No se ejecutaron `migrate:oauth` ni `update-demo-passwords.js`. `npm test` reemplaza el acceso a la BD con dobles de prueba y no crea conexiones MySQL.

Pendiente para afirmar equivalencia integral en el entorno real: iniciar la instancia MySQL existente sin modificarla, repetir pruebas de lectura/login con cuentas autorizadas y comprobar formularios/callbacks reales en un entorno de pruebas. No se afirma una garantía absoluta de ausencia de regresiones a partir de mocks y builds.
