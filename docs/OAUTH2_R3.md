> Documento histórico de OAuth. La arquitectura y verificación posteriores están en [REFACTOR.md](REFACTOR.md); sus resultados históricos no son pruebas ejecutadas en esta refactorización.

# OAuth 2.0 en Ejercicio R3 / PetCare

Se extendió el proyecto existente. No se reemplazó React, Express, MySQL ni el
login tradicional. Hay adaptadores para Google, GitHub, Facebook, Discord, Twitch y X.
**Faltan las aplicaciones y credenciales reales**: sus botones permanecen
deshabilitados hasta configurarlas. No hay un acceso simulado en la aplicación.
Los mocks existen exclusivamente dentro de las pruebas.

## 1. ¿Qué es OAuth 2.0?

Es un framework de **autorización**: permite conceder acceso limitado a recursos
de otro servicio sin entregar a PetCare la contraseña del usuario en ese servicio.
No define por sí solo cómo autenticar personas.

Referencia del profesor: [introducción de Auth0](https://auth0.com/es/intro-to-iam/what-is-oauth-2).
En Google usamos OpenID Connect (OIDC), que agrega autenticación y un ID token
validado. Con los demás proveedores consultamos su API de identidad autorizada.
Después resolvemos esa identidad en MySQL y creamos una sesión propia de PetCare.

## 2. Componentes principales

| Componente | Ejemplo en PetCare |
|---|---|
| Resource Owner | Persona que controla la cuenta y concede el permiso |
| Client | PetCare; el backend guarda el secreto y canjea el código |
| Authorization Server | Servidor del proveedor que solicita autorización y emite tokens |
| Resource Server | API del proveedor que entrega el perfil permitido |

## 3. Conceptos utilizados

- **Client ID:** identifica públicamente la aplicación registrada.
- **Client Secret:** credencial de la aplicación confidencial, solo en el backend.
- **Redirect URI:** callback exacto registrado; no es la pantalla `/login`.
- **Scopes:** permisos limitados, por ejemplo `identify email` en Discord.
- **Authorization Code:** código temporal devuelto al callback y canjeado por el servidor.
- **Access Token:** autoriza consultar la API externa. No es nuestro JWT de sesión.
- **Refresh Token:** permitiría renovar el access token; no pedimos uso offline ni
  lo guardamos. Si algún proveedor lo entrega, se descarta.
- **State:** valor aleatorio que relaciona una respuesta con un intento iniciado.
- **PKCE:** guardamos `code_verifier` y enviamos su SHA-256 como `code_challenge`
  (`S256`). El canje presenta el original. Se utiliza con Google, GitHub y X.
- **Nonce:** liga el ID token Google al intento que inició nuestro navegador.
- **ID token:** afirmación OIDC firmada. `jose` valida firma con claves Google,
  emisor, audiencia, vencimiento, claims requeridos y nonce.

Facebook, Discord y Twitch usan Authorization Code con cliente confidencial y
secreto en el backend; estos adaptadores no presuponen soporte PKCE. No usamos
Implicit ni enviamos access tokens al frontend.

## 4. Análisis previo y flujo del proyecto

### Stack y estructura reales

- Principal: React 19, TypeScript, Vite, React Router, React Hook Form, Axios,
  Bootstrap Grid, Lucide y estilos propios claro/oscuro.
- API: Node.js, Express 5, mysql2, bcryptjs, jsonwebtoken, express-validator,
  CORS, dotenv y multer. Probado con Node 24.
- `src/`: aplicación principal. `frontend-usestate/`: variante independiente que
  conserva Bearer. Los directorios `src-backups/` son copias antiguas, no se modificaron.
- `server.js` importa la API modular. Vite redirige `/api` y `/uploads` al backend.
- El pool MySQL carga `backend/.env`. React no recibe credenciales de base de datos.
- Registro original: validación → bcrypt de 12 rondas → usuario Cliente → perfil `clientes`.
- Login original: email + contraseña + estado activo → JWT Bearer guardado en
  localStorage. Ese contrato sigue funcionando.

### Rutas conservadas

Frontend: `/login`, `/registro`, `/`, `/mascotas`, `/pacientes`, `/turnos`,
`/consultas`, `/perfil`, `/admin`, `/admin/usuarios`, `/admin/mascotas`, `/admin/turnos`.

API (prefijo `/api`):

| Grupo | Rutas y métodos |
|---|---|
| Estado | GET `/health` |
| Autenticación | POST `/auth/register`, `/auth/login`, `/auth/logout`; GET/PUT `/auth/me` |
| Mascotas | GET/POST `/mascotas`; PUT/DELETE `/mascotas/:id`; PATCH `/mascotas/:id/deactivate`; GET `/mascotas/:id/detalle` |
| Catálogos | GET `/especies`, `/razas`, `/veterinarios`, `/pacientes` |
| Turnos | GET/POST `/turnos`; GET `/turnos/hoy`; PATCH `/turnos/:id/cancelar`, `/turnos/:id/estado` |
| Clínica | GET `/consultas`, `/dashboard` |
| Administración | GET `/admin/resumen`, `/admin/usuarios`, `/admin/usuarios/:id`, `/admin/mascotas`, `/admin/turnos`, `/admin/turnos/:id`; PUT/DELETE `/admin/usuarios/:id`; PATCH `/admin/usuarios/:id/estado` |
| Fotos | POST `/uploads/mascota`; archivos servidos bajo `/uploads` |

### Flujo OAuth

```text
Usuario → botón del login → GET /api/auth/github
  → crear state, cookie de intento y PKCE
  → proveedor solicita autorización
  → GET /api/auth/github/callback?code=...&state=...
  → comprobar cookie, state, proveedor y vencimiento; consumir intento
  → backend canjea Code por Token
  → obtener identidad autorizada (OIDC validado para Google)
  → buscar proveedor + ID externo en MySQL
      existe y activo → recuperar usuario
      no existe, email libre o ausente → crear usuario + cliente + identidad
      email ocupado → rechazar sin crear ni vincular
  → cookie HttpOnly con JWT de PetCare
  → /login?oauth=success → GET /api/auth/me
  → /admin para administrador, / para los demás roles
```

Al volver de OAuth se elimina un Bearer anterior para no mezclar identidades.
Axios usa `withCredentials`; JavaScript no puede leer la cookie HttpOnly.
El logout espera su eliminación y muestra un error de conexión si no puede confirmarla.

## 5. Registro automático

Se busca el rol `Cliente` en el catálogo, sin aceptar roles externos. Se guardan
nombre disponible, apellido si existe, email si existe y password_hash NULL. La
fecha proviene del default de `usuarios.fecha_creacion`. Se crea `clientes` para
que el usuario pueda usar las funciones veterinarias existentes.

Guardamos el avatar autorizado en `oauth_accounts.avatar_url`. La pantalla mantiene
las iniciales del componente Avatar, conservando el diseño y evitando nuevas
cargas de fotos de perfil externas.

No inventamos emails. GitHub usa la lista autorizada y el primario verificado;
Discord utiliza email solo cuando `verified` es verdadero. Si no se obtiene email,
queda NULL. El adaptador X no solicita correo. El email recibido es un atributo de
perfil, nunca una prueba suficiente para unir cuentas.

## 6. Segundo ingreso y cuentas con el mismo email

La clave es **provider + provider_user_id**, porque nombre y email pueden cambiar.
No se sobrescriben datos locales en cada login. UNIQUE evita duplicados incluso
con callbacks simultáneos; la transacción revierte un alta incompleta.

**Estrategia elegida:** si la identidad externa es nueva pero el email coincide
con una cuenta existente, se devuelve `OAUTH_EMAIL_CONFLICT`. No se crea un usuario
duplicado ni se vincula silenciosamente, aunque el proveedor considere verificado
el correo. Se debe entrar con el método original de esa cuenta.

No se implementa vinculación manual desde perfil: requeriría probar control de ambas
cuentas, reautenticación reciente y confirmación explícita. La decisión está comentada
en `oauthAccounts.js`. Sin email no se puede inferir que dos proveedores representan
a una misma persona: se tratan como identidades distintas, nunca se unen por nombre.

Una cuenta OAuth sin contraseña recibe un 401 genérico si intenta login local;
no se llama a bcrypt con NULL. Las contraseñas existentes no se modifican.

La normalización de email usa `validator`, igual que express-validator en el
registro existente: por ejemplo, puntos/alias de Gmail no eluden el control de
correo repetido. Se declaró `validator` como dependencia directa del backend.

## 7. Base de datos

Se inspeccionaron 12 tablas reales: usuarios, clientes, veterinarios, roles,
estados_usuario, mascotas, especies, razas, turnos, estados_turno, consultas y especialidades.
`usuarios.id` es INT UNSIGNED; nombre/apellido VARCHAR(60), email VARCHAR(120) único,
hash VARCHAR(255), rol/estado con FK, fechas y un campo foto_url anterior.

Migración `backend/migrations/001_oauth.sql`:

1. Permite NULL en email y password_hash; conserva índices y datos anteriores.
2. Crea `oauth_accounts`: ID, FK a usuario, proveedor, ID externo, avatar y fecha.
   UNIQUE binario de proveedor/ID externo. ON DELETE CASCADE evita identidades
   huérfanas al usar la eliminación administrativa ya existente.
3. Crea `oauth_flows`: hashes de state/cookie, proveedor, verifier, nonce y vencimiento.
   Los intentos caducan a los 10 minutos y se limpian al iniciar nuevos intentos.

No elimina usuarios ni tablas existentes. Se puede repetir. MySQL hace commit
implícito de DDL: no se presenta como migración atómica. En otra instalación conviene
contar con el respaldo habitual antes de migrar.

Se aplicó a la base local y se comparó una huella de todos los registros `usuarios`
antes/después: resultaron idénticos. No se cambió el campo foto_url anterior.

## 8. Seguridad

- Secretos únicamente en backend/.env, ignorado por Git, nunca con prefijo VITE_.
- State/cookie aleatorios de 256 bits y consumo atómico de un solo uso.
- PKCE S256 y nonce OIDC donde corresponde.
- Cookie host-only, HttpOnly, SameSite=Lax, Path=/api y Secure en producción.
- Las escrituras con cookie y logout exigen Origin exacto de CLIENT_URL.
- CORS conserva un origen concreto con credenciales, nunca un comodín.
- JWT OAuth vence según JWT_EXPIRES_IN (default 8 h); se consulta estado y rol
  actuales en cada petición cookie. No se coloca en URL ni localStorage.
- No se almacenan access/refresh tokens. No se imprimen respuestas del proveedor.
- Callback con no-store/no-referrer; mensajes propios, sin error_description externo.
- Fetch a proveedores con timeout y sin seguir redirecciones.
- SQL parametrizado, transacciones, FK y UNIQUE para integridad.
- Catálogo cerrado de endpoints y callbacks calculados desde URLs validadas.
  No se aceptan `returnTo` ni redirects arbitrarios del navegador.
- Se reutiliza el límite de intentos del login al iniciar OAuth.

Se conserva el esquema JWT stateless: logout quita la copia del navegador pero no
añade una lista de revocación de tokens robados. El login local sigue con Bearer en
localStorage por compatibilidad, con su exposición previa a XSS. No se afirma haber
auditado por completo funcionalidades ajenas a OAuth.

Despliegue soportado: frontend/API en el **mismo sitio** y HTTPS, preferentemente
un solo origen con `/api` detrás de proxy. Subdominios del mismo dominio requieren
configurar VITE_API_URL/CORS. Sitios de dominios distintos no funcionan con Lax;
no cambiar a SameSite=None sin diseñar esa arquitectura. En local usar `localhost`
consistentemente, sin mezclarlo con `127.0.0.1` en el navegador.

## 9. Configuración paso a paso

### Ejecutar PetCare

1. Usar Node 22.12+ (probado con 24) y MySQL/MariaDB con la base PetCare existente.
   Esta copia no contenía los archivos originales database/schema.sql/datos.sql
   citados en el README anterior. La migración OAuth no reconstruye esa base.
2. Iniciar MySQL y revisar DB_HOST, DB_PORT, DB_USER, DB_PASSWORD y DB_NAME.
3. Copiar backend/.env.example a backend/.env **solo si no existe**. Si existe,
   conservar sus valores y completar las variables nuevas. Elegir JWT_SECRET
   aleatorio, largo y privado; no usar la clave de ejemplo.
4. Raíz: `npm install`. Backend: `npm install` y `npm run migrate:oauth`.
5. Backend: `npm run dev`. Otra terminal, raíz: `npm run dev`.
6. Abrir `http://localhost:5173/login`.
7. Completar cada par CLIENT_ID/CLIENT_SECRET desde el portal y reiniciar la API.

```dotenv
CLIENT_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000
```

CLIENT_URL ya existía y define frontend/CORS; BACKEND_URL es la API pública sin
`/api` al final. No hace falta SESSION_SECRET: usamos JWT_SECRET y secretos
aleatorios de intento, no express-session. `.env.example` raíz solo ofrece
`VITE_API_URL=/api`. Nunca copiar secretos del backend al frontend.

### Callbacks calculados para esos valores

| Proveedor | Redirect URI / Callback URL |
|---|---|
| Google | `http://localhost:3000/api/auth/google/callback` |
| GitHub | `http://localhost:3000/api/auth/github/callback` |
| Facebook | `http://localhost:3000/api/auth/facebook/callback` |
| Discord | `http://localhost:3000/api/auth/discord/callback` |
| Twitch | `http://localhost:3000/api/auth/twitch/callback` |
| X | `http://localhost:3000/api/auth/twitter/callback` |

Si cambiás protocolo/dominio/puerto, actualizar variables y registro del proveedor.
Estos son los callbacks de PetCare, no una garantía de que cada portal acepte HTTP
local. Si exige HTTPS, usar un dominio de desarrollo HTTPS, actualizar ambas URLs
y registrar el callback exacto. La vuelta al frontend es siempre `/login`.

### Google

1. Crear/elegir proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Configurar Google Auth Platform/consentimiento: nombre, contacto, audiencia y
   usuarios de prueba mientras no esté publicado.
3. Crear cliente **Web application** y registrar el callback Google.
4. Completar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.
5. Scopes: openid email profile. Revisar los requisitos de publicación/verificación
   que muestre la consola; no se pide acceso a Drive ni Gmail.

Fuente: [OpenID Connect de Google](https://developers.google.com/identity/openid-connect/openid-connect).

### GitHub

1. [Developer settings / OAuth Apps](https://github.com/settings/developers) → registrar OAuth App.
2. Homepage del frontend y Authorization callback URL de GitHub de la tabla.
3. Generar secreto y completar GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET.
4. Scopes read:user y user:email; PKCE S256. Revisar restricciones de organización
   si corresponden. Sin email primario verificado, se guarda NULL.

Fuente: [autorizar OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

### Facebook / Meta

1. Crear app en [Meta for Developers](https://developers.facebook.com/apps/) con
   caso de uso/producto Facebook Login.
2. Configurar dominios y Valid OAuth Redirect URIs.
3. App ID → FACEBOOK_CLIENT_ID; App Secret → FACEBOOK_CLIENT_SECRET.
4. Copiar la versión Graph API asignada a FACEBOOK_GRAPH_VERSION (formato vNN.N).
   Sin versión explícita el botón está deshabilitado; no se inventó una versión.
5. Scopes public_profile y email. En desarrollo, probar con cuentas autorizadas por
   rol de app. Para público general revisar modo Live, privacidad, eliminación de
   datos, revisión de permisos y verificaciones que pida Meta.
6. El ID puede ser específico de la app; cambiar de app Meta no garantiza continuidad.

Referencia: [flujo manual Meta](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/).
La documentación respondió HTTP 429 a la consulta automatizada durante esta entrega;
la configuración vigente del portal y una prueba real quedan pendientes.

### Discord

1. Crear app en [Discord Developer Portal](https://discord.com/developers/applications).
2. OAuth2 → agregar Redirect URI exacta.
3. Completar DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET.
4. Scopes identify y email. No requiere instalar un bot ni permisos sobre servidores.

Fuente: [OAuth2 Discord](https://docs.discord.com/developers/topics/oauth2).

### Twitch

1. Registrar app en [Twitch Developer Console](https://dev.twitch.tv/console/apps).
2. Configurar OAuth Redirect URL, nombre y categoría adecuada.
3. Elegir cliente confidencial, generar secreto y completar TWITCH_CLIENT_ID /
   TWITCH_CLIENT_SECRET. Cumplir requisitos de cuenta/2FA del portal.
4. Scope user:read:email. Helix `/users` recibe Bearer y Client-Id.

Fuente: [Authorization Code Twitch](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth).

### X / Twitter

1. Configurar app en [Developer Console X](https://developer.x.com/).
2. Activar OAuth 2.0 User Authentication, tipo **Web App** confidencial.
3. Registrar callback terminado en `/twitter/callback`, website y URLs exigidas.
4. Completar TWITTER_CLIENT_ID / TWITTER_CLIENT_SECRET con valores OAuth 2.0;
   no confundir con API keys OAuth 1.0a ni Bearer app-only.
5. Se usa PKCE S256, tweet.read y users.read para `/2/users/me`. No se solicita
   users.email ni offline.access: no se depende de recibir correo.
6. Confirmar acceso/cuotas/condiciones del plan para `/2/users/me`. Un acceso
   denegado genera error, nunca una identidad simulada.

Fuente: [Authorization Code con PKCE de X](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code).

### Nuevos endpoints

- GET `/api/auth/providers`: catálogo y disponibilidad sin secretos.
- GET `/api/auth/:provider`: inicio de autorización.
- GET `/api/auth/:provider/callback`: validar respuesta y resolver cuenta.

Solo se admiten google, github, facebook, discord, twitch y twitter.

## 10. Archivos nuevos y modificados

| Archivo(s) | Función |
|---|---|
| backend/src/config/oauth.js (nuevo) | Catálogo, scopes, URLs, configuración |
| backend/src/services/oauthIdentity.js (nuevo) | Canje, perfil y OIDC |
| backend/src/services/oauthFlows.js (nuevo) | State, PKCE, nonce y consumo atómico |
| backend/src/services/oauthAccounts.js (nuevo) | Registro transaccional e identidad |
| backend/src/utils/oauthCookies.js (nuevo) | Cookies HttpOnly |
| backend/src/routes/oauthRoutes.js (nuevo) | Catálogo, inicio y callback |
| backend/migrations/001_oauth.sql; backend/scripts/migrate-oauth.js (nuevos) | Migración repetible |
| backend/scripts/test-oauth.js (nuevo) | Pruebas con BD efímera |
| backend/src/server.js | Monta OAuth después de rutas locales |
| backend/src/config/database.js | Puerto configurable para instancia aislada |
| backend/src/middleware/auth.js | Cookie, Origin, estado y rol |
| backend/src/controllers/authController.js; backend/src/routes/authRoutes.js | Password NULL y logout cookie |
| src/components/OAuthButtons.tsx; src/styles/oauth.css (nuevos) | Logos locales y botones adaptables |
| src/pages/LoginPage.tsx | Integra acceso externo y errores |
| src/services/api.ts; src/context/AuthContext.tsx | Credentials y recuperación de sesión |
| src/services/authService.ts; src/components/Layout.tsx | Cierre asíncrono y errores |
| src/types.ts; src/pages/ProfilePage.tsx; src/pages/admin/AdminUsersPage.tsx | Email opcional y edición sin inventarlo |
| src/pages/admin/AdminAppointmentsPage.tsx | Variable sin uso que bloqueaba build antes de OAuth |
| backend/package.json y lockfile | jose, validator y scripts |
| package.json y lockfile raíz | Simple Icons |
| backend/.env.example; .env.example; .gitignore | Configuración y exclusión de temporales |
| backend/.env, local e ignorado | Claves OAuth vacías, conservando configuración previa |
| README.md; docs/OAUTH2_R3.md | Uso, estudio y verificación |

`dist/` se regeneró por build. No se modificaron backups ni la variante useState.
No había metadata Git en esta carpeta: no se creó commit.

## 11. Código importante

```js
WHERE o.provider = ? AND o.provider_user_id = ?
```

Los valores se pasan separados del SQL. Ambas columnas identifican la cuenta sin
confundir IDs de proveedores distintos ni depender del email.

```js
if (sameEmail.length) throw new Error('OAUTH_EMAIL_CONFLICT');
```

La identidad nueva no se apropia de una cuenta existente. La transacción se revierte.

```js
url.searchParams.set('code_challenge', challenge(flow.verifier));
url.searchParams.set('code_challenge_method', 'S256');
```

El navegador lleva el hash, el original queda en el backend. PKCE protege el canje;
state y la cookie relacionan el callback con el navegador.

```js
const flow = await consumeFlow(provider, req.query.state, browser);
const identity = await externalIdentity(provider, req.query.code, flow);
const user = await resolveAccount(provider, identity);
```

El orden evita crear cuentas antes de validar el intento y la identidad externa.

```js
res.cookie(sessionCookie, token, cookieOptions());
```

`token` es un JWT de PetCare, no el access token externo. HttpOnly impide leerlo
desde JS. `/auth/me` entrega únicamente los datos públicos del usuario.

## 12. Verificación y límites conocidos

- `npm run build`: aprobado; Vite advierte un bundle superior a 500 kB.
- `cd backend && npm run test:oauth`: suite con base aleatoria que copia estructura,
  no datos reales. Requiere permisos CREATE/DROP DATABASE; elimina solo su base.
  Comprueba login/registro local, bcrypt, NULL, conflicto de email, segundo ingreso,
  concurrencia, inactivos, state/vencimiento/replay, PKCE, cookies, CSRF, adaptadores,
  cancelación, callback completo y proveedor no configurado.
- XAMPP se cerró durante las primeras pruebas y presenta errores InnoDB ya visibles
  en logs anteriores al cambio. Se usó una segunda instancia temporal MariaDB 10.4.32
  con el esquema real para las pruebas completas; no se reparó ni reemplazó la original.
- Suite heredada: 12 aprobadas y 4 fallidas por login demo Cliente y comprobaciones
  dependientes. Administrador/Veterinario sí accedieron a la base existente. No se
  modificaron contraseñas para forzar pruebas verdes.
- Resultado de integración: **17 casos aprobados** en la instancia aislada, incluyendo
  normalización de Gmail y validación criptográfica OIDC. Login y logout de administrador
  también comprobados desde el navegador.
- Lint global: 11 errores y 5 advertencias preexistentes. Conserva errores previos de hooks/Fast Refresh y backups. No se
  ocultaron reglas ni se modificaron pantallas ajenas a la actividad para silenciarlos.
- Interfaz revisada en escritorio, tablet y celular. Los seis botones deshabilitados
  muestran que falta configuración; login y registro tradicionales permanecen.
- Pendiente: autorización real con los seis proveedores y credenciales del propietario,
  cancelación/reingreso reales y despliegue HTTPS con cookies Secure. Los mocks de
  pruebas no sustituyen esa validación externa.

Demostración en clase: configurar un proveedor → ingresar por primera vez → comprobar
filas en usuarios/clientes/oauth_accounts → cerrar sesión → volver a ingresar.
El ID interno debe mantenerse. Probar cancelación y correo local coincidente:
debe rechazarse la vinculación y conservarse la cuenta original.
