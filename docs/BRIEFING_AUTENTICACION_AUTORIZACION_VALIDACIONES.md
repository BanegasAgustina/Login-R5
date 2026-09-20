# Briefing de autenticación, autorización y validaciones

Proyecto: Login-R5 en OneDrive/Documentos/GitHub. Revisión: 20 de septiembre de 2026.

Esta guía describe la implementación presente: contenido de cada archivo, flujo y motivo técnico. Los motivos se deducen de la estructura del código; no se atribuyen autores ni decisiones históricas sin evidencia. Se agregan comentarios sin modificar la lógica.

## Conceptos y recorrido

Autenticación comprueba quién es el usuario; autorización decide qué puede hacer; validación comprueba datos y reglas del negocio. Normalización transforma datos y serialización pública decide qué campos se devuelven. React ayuda al usuario, Express aplica controles y MySQL conserva identidad, roles y pertenencia.

1. **Registro:** RegisterPage valida y compara confirmación → authService → authRoutes valida y normaliza → authController genera bcrypt → userRepository crea Cliente → vuelta al login, sin sesión automática.
2. **Login:** formulario → rateLimit y validación → búsqueda de cuenta activa → bcrypt.compare → JWT y publicUser → AuthContext guarda Bearer y usuario.
3. **Petición protegida:** api envía Bearer/cookie → authMiddleware verifica JWT y consulta cuenta activa → allowRoles y filtros del recurso → consulta de negocio.
4. **OAuth:** OAuthButtons → oauthRoutes/createFlow → proveedor → callback/consumeFlow → externalIdentity → resolveAccount → cookie HttpOnly con JWT propio → AuthContext consulta /me.
5. **Cierre:** el servidor elimina cookie; AuthContext quita Bearer y usuario. No hay lista de revocación de JWT Bearer: eliminarlo del navegador no invalida otras copias hasta su vencimiento o rechazo por estado de cuenta.

## Inventario por archivo

### Rutas y validación de acceso local

**Archivo:** [backend/src/routes/authRoutes.js](../backend/src/routes/authRoutes.js)

**Contenido y funcionamiento:** registerValidation encadena trim, obligatoriedad, longitudes y reglas de nombre, email, teléfono y contraseña. updateProfileValidation admite cambios parciales. validate devuelve el primer error con HTTP 400. Las rutas llaman a register, login, me, updateMe y logout.

**Motivo y límites:** Separa el contrato HTTP del trabajo con usuarios. Login exige email y contraseña presente; no aplica requisitos de creación a una contraseña existente. confirmPassword es opcional en la API y el formulario lo compara antes de enviar.

### Registro, login y perfil

**Archivo:** [backend/src/controllers/authController.js](../backend/src/controllers/authController.js)

**Contenido y funcionamiento:** register normaliza email, verifica duplicados, genera bcrypt con coste 12 y crea un Cliente. login busca una cuenta activa, compara el hash, limpia intentos y emite JWT. me y updateMe trabajan con req.user.id. logout elimina la cookie y verifica Origin cuando existe esa cookie.

**Motivo y límites:** El controlador coordina repositorio, sesión y respuesta pública. Una cuenta OAuth con password_hash NULL no puede usar login local. El registro devuelve confirmación, no inicia sesión automáticamente.

### Emisión de JWT

**Archivo:** [backend/src/auth/session.js](../backend/src/auth/session.js)

**Contenido y funcionamiento:** createSessionToken firma id y rol con JWT_SECRET; JWT_EXPIRES_IN define la duración y el valor por defecto es 8h.

**Motivo y límites:** Centraliza el formato para login local y OAuth. El rol incluido en el token no es la fuente de autorización: el middleware recupera el estado y rol actuales de MySQL.

### Comprobación de identidad y permisos

**Archivo:** [backend/src/middleware/auth.js](../backend/src/middleware/auth.js)

**Contenido y funcionamiento:** authMiddleware prioriza Bearer sobre cookie, verifica firma y vencimiento, exige un id entero positivo y consulta la cuenta activa. Para escrituras con cookie exige Origin exacto. allowRoles permite solo los tipos indicados.

**Motivo y límites:** Consultar la cuenta en cada solicitud hace efectivos cambios de rol o desactivaciones. El catch actual responde 401 también ante errores de consulta: ese resultado no distingue una caída de DB de una sesión inválida.

### Política de roles del servidor

**Archivo:** [backend/src/auth/userTypes.js](../backend/src/auth/userTypes.js)

**Contenido y funcionamiento:** USER_TYPES define admin, veterinarian y client; USER_TYPE_NAMES los vincula con los nombres del catálogo. hasUserType compara tipo_usuario con el id positivo incluido en userTypes.

**Motivo y límites:** Evita asumir que Administrador, Veterinario y Cliente tienen ids fijos. La política usa claves estables y el repositorio resuelve sus ids reales.

### Catálogo de roles

**Archivo:** [backend/src/repositories/roleRepository.js](../backend/src/repositories/roleRepository.js)

**Contenido y funcionamiento:** listRoles consulta roles; getUserTypes arma el mapa por nombre; requireUserTypeId exige un rol configurado; roleExists verifica un id recibido.

**Motivo y límites:** La base conserva la autoridad sobre el catálogo. El registro necesita resolver Cliente y la administración valida que el rol elegido exista.

### Persistencia de usuarios

**Archivo:** [backend/src/repositories/userRepository.js](../backend/src/repositories/userRepository.js)

**Contenido y funcionamiento:** createUserRepository permite inyectar una conexión o pool. withTypes agrega tipo_usuario y userTypes. findSessionById, findById y findActiveByEmail tienen proyecciones distintas. emailExists, createClient y updateProfile gestionan datos con parámetros SQL.

**Motivo y límites:** Los placeholders separan datos de SQL. createClient hace dos INSERT consecutivos sin transacción explícita; no se debe atribuirle la atomicidad de resolveAccount. updateProfile solo toma nombre, apellido y teléfono.

### Respuesta pública del usuario

**Archivo:** [backend/src/utils/sanitize.js](../backend/src/utils/sanitize.js)

**Contenido y funcionamiento:** publicUser construye una lista explícita de campos: identidad, rol, estado, teléfono, fechas y resúmenes de mascotas; adapta nombres de columnas al contrato del frontend.

**Motivo y límites:** Al construir el objeto explícitamente evita enviar password_hash u otras columnas nuevas por accidente. No modifica la fila de MySQL ni valida la entrada.

### Límite de intentos

**Archivo:** [backend/src/middleware/rateLimit.js](../backend/src/middleware/rateLimit.js)

**Contenido y funcionamiento:** loginRateLimit usa un Map por IP: ventana de 15 minutos, 8 solicitudes admitidas y bloqueo al superar ese número. clearLoginAttempts borra el registro tras login local exitoso.

**Motivo y límites:** Reduce intentos repetidos, pero el contador vive en un proceso y se reinicia con él. No es un límite distribuido entre varias instancias. También se aplica al inicio OAuth.

### Cabeceras HTTP

**Archivo:** [backend/src/middleware/security.js](../backend/src/middleware/security.js)

**Contenido y funcionamiento:** securityHeaders establece nosniff, DENY, política de Referer y deshabilita el filtro X-XSS-Protection antiguo. En producción agrega HSTS.

**Motivo y límites:** Estas cabeceras controlan comportamientos del navegador; no sustituyen validar entradas, autenticar o comprobar permisos.

### Catálogo y configuración OAuth

**Archivo:** [backend/src/config/oauth.js](../backend/src/config/oauth.js)

**Contenido y funcionamiento:** providers define Google, GitHub, Facebook, Discord, Twitch y X, sus endpoints, scopes y variantes PKCE/Basic. origin valida orígenes; frontendOrigin, backendOrigin y callbackURL construyen destinos. configured y environmentStatus informan presencia de variables.

**Motivo y límites:** Los destinos salen de configuración del servidor. configured indica que hay valores requeridos, no que el proveedor los haya aceptado ni que MySQL funcione.

### Inicio y callback OAuth

**Archivo:** [backend/src/routes/oauthRoutes.js](../backend/src/routes/oauthRoutes.js)

**Contenido y funcionamiento:** GET /providers publica disponibilidad. GET /:provider crea el intento, guarda cookie temporal y redirige. El callback consume state, valida code, obtiene identidad, resuelve cuenta y emite cookie con JWT de PetCare. fail limita los códigos de error y redirige al login.

**Motivo y límites:** El orden une navegador, proveedor y sesión local. Cache-Control y Referrer-Policy evitan conservar o reenviar datos del callback. El token externo no se devuelve al frontend.

### Intentos OAuth de un solo uso

**Archivo:** [backend/src/services/oauthFlows.js](../backend/src/services/oauthFlows.js)

**Contenido y funcionamiento:** randomSecret produce valores aleatorios; hash usa SHA-256 hexadecimal y challenge SHA-256 base64url para PKCE. createFlow guarda hashes de state/browser, verifier y nonce, con vencimiento de 10 minutos. consumeFlow verifica formato, proveedor y navegador dentro de una transacción.

**Motivo y límites:** SELECT FOR UPDATE y DELETE consumen el intento atómicamente. timingSafeEqual compara hashes. La limpieza elimina intentos vencidos; verifier y nonce se guardan como valores, no como los hashes de state/browser.

### Validación de la identidad externa

**Archivo:** [backend/src/services/oauthIdentity.js](../backend/src/services/oauthIdentity.js)

**Contenido y funcionamiento:** json realiza fetch con timeout de 10 segundos y sin seguir redirects. externalIdentity canjea code, agrega verifier o Basic según proveedor y transforma el perfil a un formato común. Google usa jose, JWKS, emisor, audiencia, RS256 y nonce; los demás consultan APIs de perfil.

**Motivo y límites:** OAuth access_token sirve para consultar al proveedor, no para autorizar rutas PetCare. GitHub toma email primario verificado; Discord exige verified para usar email; X no presupone email. El id final debe ser ASCII imprimible de 1 a 255 caracteres.

### Asociación de identidad externa y usuario

**Archivo:** [backend/src/services/oauthAccounts.js](../backend/src/services/oauthAccounts.js)

**Contenido y funcionamiento:** profile normaliza email, recorta nombres y acepta avatar con prefijo HTTPS. resolveAccount busca por provider + provider_user_id. Si no existe, comprueba conflicto de email y crea usuario Cliente, perfil cliente y vínculo en una transacción.

**Motivo y límites:** No vincula automáticamente por email. Las cuentas inactivas se rechazan; una carrera de inserción se resuelve tras rollback consultando la identidad exacta. La cuenta nueva tiene contraseña local NULL.

### Cookies de sesión e intento

**Archivo:** [backend/src/utils/oauthCookies.js](../backend/src/utils/oauthCookies.js)

**Contenido y funcionamiento:** cookieOptions fija HttpOnly, SameSite=Lax, path=/api y Secure en producción. sessionCookie define petcare_oauth. readCookie busca y decodifica una cookie, devolviendo vacío si está ausente o mal codificada.

**Motivo y límites:** HttpOnly impide lectura por JavaScript del navegador. La cookie temporal añade maxAge en el router; la cookie de sesión no lo define aquí. SameSite=Lax merece revisar el esquema de dominios en despliegues entre sitios distintos.

### Carga del entorno

**Archivo:** [backend/src/config/environment.js](../backend/src/config/environment.js)

**Contenido y funcionamiento:** dotenv carga backend/.env mediante una ruta relativa a import.meta.url, convertida con fileURLToPath.

**Motivo y límites:** La ruta no depende del directorio desde el que se inicia Node. Las variables ya inyectadas en process.env se conservan; no se usa override.

### Configuración y pool MySQL

**Archivo:** [backend/src/config/database.js](../backend/src/config/database.js)

**Contenido y funcionamiento:** fromPublicUrl interpreta MYSQL_PUBLIC_URL. databaseConfig toma los campos de URL presentes y usa DB_* como alternativa; establece timeout y límite de conexiones. pool reutiliza conexiones. checkDatabaseConnection abre conexión directa y ejecuta SELECT 1.

**Motivo y límites:** Crear el objeto pool no prueba autenticación. Una consulta real es necesaria. La configuración influye en sesiones, permisos y OAuth porque estos consultan MySQL; no se incluyen valores secretos en este briefing.

### Orden de middlewares y routers

**Archivo:** [backend/src/app.js](../backend/src/app.js)

**Contenido y funcionamiento:** Configura trust proxy, cabeceras, CORS con credenciales y JSON hasta 100kb. Monta authRoutes antes de oauthRoutes en /api/auth, además de administración, imágenes y rutas de negocio. Incluye health, 404 y error central.

**Motivo y límites:** El orden permite que /login, /register y /me se resuelvan antes de la ruta dinámica del proveedor. /api/health confirma que responde Express, no comprueba la conexión MySQL.

### Autorización y validaciones administrativas

**Archivo:** [backend/src/routes/adminRoutes.js](../backend/src/routes/adminRoutes.js)

**Contenido y funcionamiento:** router.use exige sesión y rol Administrador para todo el router. Valida ids, nombre, apellido, email, rol_id, estado_id, filtros y ordenación. Verifica roles existentes, emails duplicados y evita autoeliminación o autodesactivación en sus rutas correspondientes.

**Motivo y límites:** La lista de ordenaciones aceptadas selecciona fragmentos SQL propios. Los valores de filtros usan parámetros. HTTP 400 indica datos inválidos, 404 ausencia y 409 conflictos; ocultar botones en UI no sustituye estos controles.

### Permisos por recurso y reglas del negocio

**Archivo:** [backend/src/routes/petRoutes.js](../backend/src/routes/petRoutes.js)

**Contenido y funcionamiento:** getClientId/getVetId traducen usuario a perfil; resolveBreedId busca o crea raza. Las rutas cubren mascotas, catálogos, pacientes, turnos, consultas y dashboard. Validan ids, nombres, sexo, peso, raza, foto y acciones. Algunas consultas agregan condiciones de dueño o veterinario.

**Motivo y límites:** Rol y pertenencia son controles distintos. Crear turno comprueba mascota propia activa y veterinario existente. Las transiciones permitidas se expresan en una tabla. No todas las rutas tienen exactamente las mismas validaciones: consultar la matriz del briefing.

### Validación de imágenes en el servidor

**Archivo:** [backend/src/routes/uploadRoutes.js](../backend/src/routes/uploadRoutes.js)

**Contenido y funcionamiento:** createStorage genera nombres UUID y crea directorio al subir. fileFilter limita extensión y MIME; Multer limita tamaño a 5 MB. isImageSignature revisa bytes iniciales JPEG/PNG/WebP. handleUpload descarta archivos vacíos o firma incompatible y devuelve URL.

**Motivo y límites:** La extensión y el MIME del cliente no bastan por sí solos. Comprobar firma suma un control, pero no equivale a decodificar por completo una imagen. POST /mascota exige sesión.

### Destino de imágenes

**Archivo:** [backend/src/config/uploads.js](../backend/src/config/uploads.js)

**Contenido y funcionamiento:** uploadsDirectory usa UPLOADS_DIR si existe o backend/uploads como valor por defecto.

**Motivo y límites:** Centraliza la ruta para que el router de carga y Express sirvan el mismo directorio. La persistencia depende del almacenamiento del despliegue.

### Estado de sesión en React

**Archivo:** [src/context/AuthContext.tsx](../src/context/AuthContext.tsx)

**Contenido y funcionamiento:** AuthProvider mantiene usuario y loading. Al montar consulta /me; tras oauth=success quita un Bearer anterior. login guarda petcare_token y usuario. logout espera al servidor y elimina estado local. useAuth exige estar dentro del proveedor.

**Motivo y límites:** React comparte una sola sesión visual entre pantallas. La cookie HttpOnly requiere intervención del servidor al cerrar sesión; eliminar localStorage no la borra.

### Cliente HTTP y transporte de sesión

**Archivo:** [src/services/api.ts](../src/services/api.ts)

**Contenido y funcionamiento:** Axios toma VITE_API_URL o /api, activa withCredentials y añade Bearer si existe petcare_token. El interceptor de respuesta quita el token y redirige en ciertos 401. getErrorMessage transforma errores de red o API en texto.

**Motivo y límites:** /auth/login y /auth/me se exceptúan de la redirección global para permitir errores del formulario y visitantes sin sesión. Las aserciones de tipos de los servicios no validan respuestas en tiempo de ejecución.

### Operaciones de autenticación desde UI

**Archivo:** [src/services/authService.ts](../src/services/authService.ts)

**Contenido y funcionamiento:** login, register, getMe, updateMe y logout encapsulan llamadas a /auth y sus tipos de datos.

**Motivo y límites:** Separa HTTP de componentes. logout solicita borrar la cookie; quien elimina petcare_token y actualiza usuario es AuthContext.

### Roles en la interfaz

**Archivo:** [src/auth/userTypes.ts](../src/auth/userTypes.ts)

**Contenido y funcionamiento:** USER_TYPES y UserType describen claves de política. hasUserType y hasAnyUserType comparan tipo_usuario con el mapa userTypes recibido.

**Motivo y límites:** No se hardcodean ids de MySQL. Estas funciones deciden presentación y navegación; la API debe volver a comprobar el permiso.

### Acceso visual a páginas

**Archivo:** [src/components/ProtectedRoute.tsx](../src/components/ProtectedRoute.tsx)

**Contenido y funcionamiento:** Mientras loading muestra PageState; sin usuario redirige a /login. Si recibe role, normaliza uno o varios tipos y consulta hasAnyUserType antes de mostrar children.

**Motivo y límites:** Evita mostrar páginas antes de recuperar sesión. La protección real de los datos sigue en Express, porque el cliente puede ser modificado.

### Mapa de rutas protegidas

**Archivo:** [src/App.tsx](../src/App.tsx)

**Contenido y funcionamiento:** AuthProvider envuelve BrowserRouter. Login y registro son públicos; Layout necesita sesión. Mascotas requiere Cliente, pacientes y consultas Veterinario, turnos Cliente o Veterinario y /admin Administrador.

**Motivo y límites:** Declara la política de navegación en un lugar. La ruta desconocida redirige a /; esto no sustituye las políticas de cada endpoint.

### Menú por rol y cierre de sesión

**Archivo:** [src/components/Layout.tsx](../src/components/Layout.tsx)

**Contenido y funcionamiento:** NAV contiene las opciones y roles. hasAnyUserType filtra el menú. cerrarSesion espera logout y muestra error si no puede completar el cierre.

**Motivo y límites:** La navegación refleja la sesión compartida. Ocultar una entrada no impide por sí mismo invocar la API.

### Formulario de login

**Archivo:** [src/pages/LoginPage.tsx](../src/pages/LoginPage.tsx)

**Contenido y funcionamiento:** React Hook Form exige email con patrón y contraseña presente. submit invoca login y dirige al administrador a /admin. oauthErrors traduce una lista cerrada de códigos; OAuthButtons inicia acceso externo.

**Motivo y límites:** El login no impone la complejidad del registro. El estado submitting evita envíos simultáneos desde el botón; la autenticación final depende del servidor.

### Formulario de alta

**Archivo:** [src/pages/RegisterPage.tsx](../src/pages/RegisterPage.tsx)

**Contenido y funcionamiento:** Usa mode onTouched y validadores de nombre, apellido, email, teléfono y contraseña; watch compara confirmPassword. submit recorta datos, llama register, muestra 409 sobre email y redirige a login tras éxito.

**Motivo y límites:** confirmPassword se usa en el formulario y no se envía en el payload construido. Crear la cuenta no entrega JWT ni inicia sesión automáticamente.

### Entrada y medidor de contraseña

**Archivo:** [src/components/PasswordInput.tsx](../src/components/PasswordInput.tsx)

**Contenido y funcionamiento:** forwardRef integra el input con React Hook Form. handleChange conserva texto para calcular getPasswordStrength y propaga onChange. El botón alterna visibilidad y el medidor es opcional.

**Motivo y límites:** El medidor comunica reglas al usuario; no genera hashes ni cifra datos. bcrypt se ejecuta en backend.

### Botones de proveedores

**Archivo:** [src/components/OAuthButtons.tsx](../src/components/OAuthButtons.tsx)

**Contenido y funcionamiento:** Consulta /auth/providers al montar, limita ids al catálogo de logos y deshabilita proveedores sin configuración. El clic navega a la URL de inicio. La bandera active evita actualizar estado tras desmontar.

**Motivo y límites:** El frontend no intercambia códigos ni recibe secretos de proveedores. Un botón habilitado indica configuración presente, no una prueba completa de autenticación.

### Reglas reutilizables de formularios

**Archivo:** [src/utils/validators.ts](../src/utils/validators.ts)

**Contenido y funcionamiento:** validatePersonName, validatePetName, validateEmail, validatePhone, validatePassword y validateImageFile devuelven texto o null. getPasswordStrength devuelve score, etiqueta, porcentaje y checks.

**Motivo y límites:** Son validaciones de experiencia de usuario. El servidor vuelve a validar la entrada; estas funciones no se importan en Express y las reglas pueden diferir.

### Selección y validación previa de imágenes

**Archivo:** [src/components/ImageUpload.tsx](../src/components/ImageUpload.tsx)

**Contenido y funcionamiento:** handleFileChange llama validateImageFile, crea una URL temporal y notifica onFileSelect. handleRemove elimina selección. Los efectos sincronizan initialUrl y liberan ObjectURL.

**Motivo y límites:** Evita subir un archivo que ya incumple reglas visibles y libera memoria de las previsualizaciones. El componente no realiza el POST ni verifica bytes de imagen.

### Formulario de mascotas

**Archivo:** [src/pages/PetsPage.tsx](../src/pages/PetsPage.tsx)

**Contenido y funcionamiento:** Combina validatePetName, campos obligatorios, catálogo de especies/razas e ImageUpload. save sube la foto seleccionada, construye payload y elige crear o actualizar. La eliminación requiere confirmación visual.

**Motivo y límites:** La UI reúne datos; la API comprueba rol y pertenencia. La foto se sube en una petición separada de la escritura de mascota.

### Formulario y acciones sobre turnos

**Archivo:** [src/pages/AppointmentsPage.tsx](../src/pages/AppointmentsPage.tsx)

**Contenido y funcionamiento:** Detecta Veterinario con hasUserType, carga listados y ofrece acciones por estado. El formulario exige mascota, veterinario, fecha, hora y motivo. Los servicios crean, cancelan o cambian estado.

**Motivo y límites:** Los campos requeridos del formulario no prueban disponibilidad horaria ni pertenencia. Las reglas de transición y acceso se deciden nuevamente en petRoutes.

### Edición administrativa de usuarios

**Archivo:** [src/pages/admin/AdminUsersPage.tsx](../src/pages/admin/AdminUsersPage.tsx)

**Contenido y funcionamiento:** Usa validadores de nombre y email, exige rol y consume el catálogo del servidor. currentUser permite ocultar acciones sobre la propia cuenta. Gestiona filtros y confirmaciones de cambios.

**Motivo y límites:** El formulario contempla campos ausentes de cuentas OAuth en ciertos casos. La API comprueba roles, duplicados y acciones sobre el propio usuario.

### Lectura de identidad actual

**Archivo:** [src/pages/ProfilePage.tsx](../src/pages/ProfilePage.tsx)

**Contenido y funcionamiento:** useAuth aporta usuario; el componente presenta datos personales, rol, estado, teléfono y fecha. Un email NULL muestra texto explicativo.

**Motivo y límites:** Es una pantalla de consulta; no implementa un formulario de edición ni modifica la sesión.

### Contratos TypeScript

**Archivo:** [src/types.ts](../src/types.ts)

**Contenido y funcionamiento:** User define id, email nullable, rolId, tipo_usuario y mapa userTypes. También contiene Pet, Appointment, Consulta y tipos administrativos usados por formularios y servicios.

**Motivo y límites:** Los tipos ayudan durante compilación; no validan JSON de la red ni conceden permisos.

### Transporte de operaciones administrativas

**Archivo:** [src/services/adminService.ts](../src/services/adminService.ts)

**Contenido y funcionamiento:** Obtiene roles, resumen, usuarios, mascotas y turnos; edita usuario, cambia estado y elimina. updateUsuario traduce rolId de frontend a rol_id de API.

**Motivo y límites:** Centraliza el contrato y filtros. No decide si el usuario está autorizado ni valida por sí mismo el contenido.

### Transporte de mascotas y pacientes

**Archivo:** [src/services/petService.ts](../src/services/petService.ts)

**Contenido y funcionamiento:** Define payloads y llamadas de listado, especies, razas, pacientes, detalle veterinario, creación, actualización y baja lógica.

**Motivo y límites:** Usa el cliente HTTP común para sesión. Los métodos deletePet y deactivatePet corresponden a endpoints que preservan el historial mediante baja lógica.

### Transporte de turnos y consultas

**Archivo:** [src/services/appointmentService.ts](../src/services/appointmentService.ts)

**Contenido y funcionamiento:** Expone consultas, dashboard, veterinarios y turnos, además de creación, cancelación y actualización de estado. La acción se tipa como confirmar, completar o cancelar.

**Motivo y límites:** El tipo restringe llamadas escritas en TypeScript, pero Express valida otra vez porque una petición externa puede enviar cualquier texto.

### Envío multipart de imágenes

**Archivo:** [src/services/uploadService.ts](../src/services/uploadService.ts)

**Contenido y funcionamiento:** uploadImage incorpora el archivo en FormData bajo imagen, llama /uploads/mascota y devuelve la URL relativa.

**Motivo y límites:** Mantiene separado el transporte de la selección y previsualización. El backend verifica tamaño, formato y firma.

### Diagnóstico de conexión

**Archivo:** [backend/scripts/test-mysql.js](../backend/scripts/test-mysql.js)

**Contenido y funcionamiento:** Carga backend/.env y arma configuración DB_*. Prueba createConnection, SELECT 1 y estado TLS; solo si funciona prueba el pool real. Acepta un puerto de diagnóstico y registra errores mediante mensajes limitados.

**Motivo y límites:** No modifica datos. La conexión manual usa DB_* mientras el pool puede priorizar MYSQL_PUBLIC_URL; esa diferencia importa al interpretar un diagnóstico.

### Aplicación del esquema OAuth

**Archivo:** [backend/scripts/migrate-oauth.js](../backend/scripts/migrate-oauth.js)

**Contenido y funcionamiento:** Lee backend/migrations/001_oauth.sql, verifica textos de las dos tablas esperadas, divide sentencias y las ejecuta con pool; finalmente cierra el pool.

**Motivo y límites:** Modifica esquema y no es una prueba de lectura. El archivo SQL referenciado no está presente en este checkout al preparar el briefing; no se ejecutó ni se reconstruyó.

### Pruebas de integración OAuth

**Archivo:** [backend/scripts/test-oauth.js](../backend/scripts/test-oauth.js)

**Contenido y funcionamiento:** Crea una base con nombre aleatorio, copia estructura de tablas, prepara datos de prueba y simula proveedores; usa assert y limpia al finalizar. Contiene casos de login, cuentas externas, state y configuración.

**Motivo y límites:** Necesita acceso MySQL y migración disponible. No se ejecutó para comentar código. Cambia DB_NAME para aislar el pool, pero una MYSQL_PUBLIC_URL presente puede tener precedencia: revisar aislamiento antes de ejecutarlo.

### Suite histórica de API

**Archivo:** [backend/scripts/test-suite.js](../backend/scripts/test-suite.js)

**Contenido y funcionamiento:** Requiere TEST_* de administrador, veterinario y cliente y una API activa. Prueba health, login y accesos mediante fetch y aserciones propias.

**Motivo y límites:** Es una herramienta de integración dependiente del entorno y datos, no una verificación estática. No se ejecutó contra Railway durante esta tarea.

### Mantenimiento de contraseñas demo

**Archivo:** [backend/scripts/update-demo-passwords.js](../backend/scripts/update-demo-passwords.js)

**Contenido y funcionamiento:** Recibe dos contraseñas por argumentos, exige longitud mínima 8, calcula bcrypt con coste 10 y actualiza las cuentas demo por email.

**Motivo y límites:** Cambia credenciales reales de esas cuentas. Su regla y coste difieren del registro normal; se documenta pero no se ejecuta. bcrypt genera hashes, no cifrado reversible.

## Matriz de validaciones

| Área | Reglas observadas | Ubicación y límite |
|---|---|---|
| Nombre/apellido | Letras españolas, espacios, apóstrofe y guion; sin números; 2–60 en registro | validators.ts/authRoutes. Perfil backend no repite límites de longitud. |
| Mascota | Nombre 2–80, letras y números, espacios, guion y apóstrofe | Frontend y alta backend. Edición backend no repite regex del alta. |
| Email | Formato y dominio; backend normaliza | No comprueba existencia del buzón ni propiedad. |
| Teléfono | Opcional; si se informa, 10–13 dígitos | validators/authRoutes. |
| Contraseña de registro | Mínimo 8, mayúscula, minúscula, número, símbolo del conjunto admitido y ausencia de lista común | Frontend y backend. La lista común es finita. |
| Contraseña de login | Presente y comparación bcrypt | No recalifica complejidad. |
| Confirmación | Igual a password | Formulario la exige; API la considera opcional; RegisterPage no la envía. |
| Medidor | Checks y categorías Débil/Media/Fuerte | Es orientación, no cálculo de entropía. |
| Ids | isInt en campos y parámetros seleccionados | No todos exigen mínimo 1; entero no implica existencia. |
| Rol | Existente en catálogo; correspondencia por nombre | roleRepository/adminRoutes; registro impone Cliente. |
| Cuenta activa | estado_id === 1 | Login, middleware y cuentas OAuth. |
| Estado de usuario | Entero 1–2; protección de autodesactivación | adminRoutes. |
| Filtros admin | trim, sort en lista, activo 0/1/vacío, fecha ISO8601 | adminRoutes selecciona ORDER BY desde mapas propios. |
| Datos mascota | especie_id entero, sexo Macho/Hembra, raza hasta 80, peso opcional 0,1–300 | petRoutes; isInt no prueba existencia de especie. |
| Foto URL | Prefijo /uploads/ o http si es string no vacío | No es validación exhaustiva de URL. |
| Crear turno | Ids enteros, fecha/hora presentes, motivo no vacío, mascota propia activa y veterinario existente | No demuestra disponibilidad, fecha futura ni ausencia de solapamiento. |
| Transiciones | Confirmar Pendiente → Confirmado; completar Pendiente/Confirmado → Completado; cancelar Pendiente/Confirmado → Cancelado | petRoutes comprueba además acceso según ruta. |
| Imagen | No vacía, hasta 5 MB, extensión y MIME JPG/JPEG/PNG/WebP | Frontend/Multer; backend agrega firma inicial de bytes, no decodificación completa. |
| Origen OAuth | HTTPS; HTTP loopback solo fuera de producción; sin credenciales, query, fragmento o path distinto de raíz | config/oauth.js. |
| Proveedor | Catálogo cerrado y configuración presente | No certifica credenciales ni funcionamiento. |
| state y cookie navegador | 43 caracteres, hashes coincidentes, proveedor y vencimiento correctos | consumeFlow consume una vez con transacción. |
| code | String presente hasta 4096 caracteres | Callback OAuth. |
| Google ID token | Firma, emisor, audiencia, RS256, claims, nonce, azp cuando existe | jose; no atribuir OIDC a las ramas de otros proveedores. |
| Perfil OAuth | Id externo ASCII imprimible 1–255; email opcional válido hasta 120; nombres recortados; avatar HTTPS hasta 2048 | oauthIdentity/oauthAccounts. |
| Escrituras cookie | Origin exacto salvo GET/HEAD/OPTIONS | Middleware; logout tiene control propio. |
| Datos de salida | Lista explícita sin password_hash | publicUser; no valida entrada. |

## Archivos de apoyo y consumidores

| Archivo | Relación |
|---|---|
| [src/main.tsx](../src/main.tsx) | Monta React y App. |
| [src/pages/DashboardPage.tsx](../src/pages/DashboardPage.tsx) | Consume sesión y adapta panel por rol. |
| [src/pages/PatientsPage.tsx](../src/pages/PatientsPage.tsx) | Vista de pacientes y detalle veterinario. |
| [src/pages/ConsultasPage.tsx](../src/pages/ConsultasPage.tsx) | Presenta consultas; App restringe pantalla. |
| [src/pages/admin/AdminDashboard.tsx](../src/pages/admin/AdminDashboard.tsx) | Resumen administrativo protegido. |
| [src/pages/admin/AdminPetsPage.tsx](../src/pages/admin/AdminPetsPage.tsx) | Filtros y ordenación de mascotas. |
| [src/pages/admin/AdminAppointmentsPage.tsx](../src/pages/admin/AdminAppointmentsPage.tsx) | Consulta y detalle de turnos administrativos. |
| [src/components/ConfirmDialog.tsx](../src/components/ConfirmDialog.tsx) | Confirmación visual; no concede permisos. |
| [src/components/PageState.tsx](../src/components/PageState.tsx) | Estados de carga/error usados al recuperar sesión. |
| [src/styles/oauth.css](../src/styles/oauth.css), [src/App.css](../src/App.css) | Presentación de pantallas y botones; no validan identidad. |
| [src/utils/fechas.ts](../src/utils/fechas.ts) | Formato de fechas y edad; no valida disponibilidad de turnos. |
| [backend/src/server.js](../backend/src/server.js) | Escucha HTTP; no demuestra conexión MySQL. |
| [backend/scripts/check-syntax.js](../backend/scripts/check-syntax.js) | Revisa sintaxis sin importar módulos de la aplicación. |
| [backend/package.json](../backend/package.json), [package.json](../package.json) | Dependencias y comandos de compilación/pruebas. |
| backend/.env y plantillas .env.example | Configuración privada y ejemplos; no se copian valores ni se editan. |
| [docs/OAUTH2_R3.md](OAUTH2_R3.md), [docs/REFACTOR.md](REFACTOR.md), [docs/MYSQL_DIAGNOSTICO.md](MYSQL_DIAGNOSTICO.md) | Documentos previos; contrastar su estado histórico con código y pruebas actuales. |
| backend/migrations/001_oauth.sql | Referenciado por migración y test-oauth, pero ausente en este checkout. |

## Respuestas y límites

- 400: datos o regla de entrada inválidos.
- 401: sesión o credenciales rechazadas; el catch del middleware también puede ocultar un fallo de DB.
- 403: rol, pertenencia u origen no permitidos.
- 404: recurso ausente; algunas rutas también evitan revelar recursos ajenos.
- 409: conflicto, como email duplicado o transición de turno.
- 429: límite de solicitudes.
- 500: error interno; el manejador general evita devolver detalles no expuestos.

OAuth redirige al login con códigos propios en lugar de devolver siempre estos errores JSON.

La validación del frontend y backend está implementada por separado y presenta diferencias. CORS controla lectura de respuestas por el navegador: no autentica. Ocultar un menú tampoco concede ni revoca permisos del servidor.

La última prueba observada de Railway rechazaba autenticación con 1045. Esta documentación no soluciona ni vuelve a probar esa conexión. Falta el SQL referenciado por migrate-oauth; no se debe presentar como aplicado. Antes de ejecutar test-oauth con MYSQL_PUBLIC_URL, revisar aislamiento: database.js prioriza la URL sobre DB_NAME, que es lo que cambia la suite para usar una base temporal.

## Orden de lectura

LoginPage → AuthContext → authService → api → authRoutes → authController → userRepository → session → authMiddleware. Después userTypes/roleRepository y ProtectedRoute/App. OAuthButtons → oauthRoutes → oauthFlows → oauthIdentity → oauthAccounts → oauthCookies explica acceso externo. Finalmente, contrastar validators, adminRoutes, petRoutes y uploadRoutes con la matriz.

## Verificación de esta edición

Se compara por archivo la salida de TypeScript antes y después con removeComments: solo se escribe si el código resultante es idéntico. No se ejecutan suites con escrituras, migraciones ni cambios de contraseña para verificar comentarios.


Resultados de la verificación: 50 archivos con salida ejecutable idéntica al quitar comentarios; sintaxis backend PASS; TypeScript y build Vite PASS; git diff --check PASS; 69 enlaces locales comprobados, sin destinos faltantes. Vite emitió un aviso de bundle mayor a 500 kB, sin impedir la compilación. No se ejecutaron pruebas de integración contra MySQL.
