# Diagnóstico MySQL / Railway — pendiente de autenticación

Proyecto examinado: `C:\Users\tomat\OneDrive\Documentos\GitHub\Login-R5`.

## Evidencia y causa del timeout

`backend/src/config/environment.js` resuelve `../../.env` desde su propio archivo: carga `backend/.env` de este proyecto, independientemente del directorio de ejecución. No se detectaron variables DB heredadas que sobrescribieran ese archivo. La carpeta anterior `C:\Users\tomat\LogIn - R5` es otra copia con MySQL local; no se utilizó para corregir Railway.

El archivo correcto contenía dos definiciones de DB_PORT. El valor efectivo era 3306 para el host público `zephyr.proxy.rlwy.net`. El TCP de la prueba previa conectaba a 21209, por lo que no estaba probando el mismo destino que mysql2.

Reproducción real: mysql2 con el puerto efectivo 3306 produjo ETIMEDOUT (syscall connect). Mismas variables, mismo driver y misma PC con puerto 21209: el servidor respondió ER_ACCESS_DENIED_ERROR (1045, SQLSTATE 28000) en aproximadamente un segundo. Se corrigió únicamente DB_PORT a 21209 y se dejó una sola definición. Ningún otro valor del .env cambió.

## Estado solicitado

| Punto | Resultado |
|---|---|
| 1. Causa ETIMEDOUT | Puerto efectivo incorrecto por definición duplicada; puerto público y puerto interno confundidos |
| 2. createConnection | FAIL actual: ER_ACCESS_DENIED_ERROR; ya no ETIMEDOUT |
| 3. SELECT 1 | Pendiente: no puede ejecutarse mientras MySQL rechace la autenticación |
| 4. createPool | Pendiente según el orden solicitado, después de conexión directa exitosa |
| 5. Pool SELECT 1 | Pendiente por autenticación |
| 6. SSL | No soluciona 1045. Sin TLS: 1045. TLS validado: certificado autofirmado en cadena. Prueba única TLS sin validar, solo en memoria: también 1045. No se persistió rejectUnauthorized:false. No se puede determinar aún si TLS es obligatorio para esa cuenta |
| 7. mysql2 | 3.24.3 antes y después; no se actualizó ninguna dependencia |
| 8. Archivos | backend/.env: únicamente puerto y duplicado. backend/scripts/test-mysql.js: diagnóstico reproducible de solo lectura. Este informe |
| 9. migrate:oauth | No ejecutado: el requisito previo SELECT 1 no pasa |
| 10. oauth_flows / oauth_accounts | Existencia y columnas remotas no verificables todavía sin autenticación |
| 11. Google OAuth | Inicio y callback pendientes; no se tocó OAuth |
| 12. Otros proveedores | GitHub, Facebook, Discord y X pendientes. Twitch no se habilitó ni modificó |
| 13. Secretos | No se imprimieron contraseñas, URLs con credenciales, Client Secrets ni tokens. .env está ignorado y no figura entre archivos versionados; no se hicieron commits |

La misma autenticación tomada del .env también falló con el cliente MySQL nativo de XAMPP, con código 1045. Esto descarta que el rechazo observado sea exclusivo de mysql2. No se observó la conexión que el usuario ejecutó en MySQL Shell, por lo que falta contrastar sus credenciales/configuración con este .env. No se modificaron usuarios, contraseñas, grants, datos ni esquema.

No hay MYSQL_PUBLIC_URL, MYSQL_URL ni DATABASE_URL configuradas. No se encontraron definiciones duplicadas de DB_PASSWORD, truncamiento aparente por # ni espacios de borde en usuario/contraseña.

## Verificaciones independientes

- Build del frontend: PASS, sin modificar su código.
- Sintaxis backend: PASS.
- npm test: ambos runners terminaron con **0 tests**; este checkout no contiene tests/ ni backend/tests/. No se presenta como una suite de regresión aprobada.
- Lint: falló; consultar el resultado de la ejecución de esta sesión. No se cambiaron reglas ni pantallas.

## Paso necesario para continuar

El usuario debe contrastar DB_USER y DB_PASSWORD del archivo local con la conexión de MySQL Shell que funciona, sin compartirlos por el chat ni cambiar credenciales del servidor. Una vez confirmados los valores correctos, ejecutar desde este proyecto:

```powershell
node backend/scripts/test-mysql.js
```

Si pasan conexión directa y pool, continuar con verificación de esquema, migración idempotente sin cambios innecesarios y pruebas de OAuth. No es necesario copiar el .env a otro proyecto.
