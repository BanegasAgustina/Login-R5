# Exportar PetCare e importar en Railway

La exportación `.sql` de `exports/` contiene la estructura y los datos reales de la base local: **14 tablas**, índices, **14 claves foráneas**, IDs, roles, usuarios y hashes de contraseñas. No incluye CREATE DATABASE, USE, DROP, DELETE, TRUNCATE ni ALTER TABLE. Se generó desde MariaDB 10.4 con `mysqldump --single-transaction`, sin modificar la base local. El manifiesto junto al SQL indica cuántas filas contiene cada tabla.

Es una copia de datos privados: los exports están excluidos de Git y del despliegue. No publicarlos como archivos del frontend. El destino debe ser **MySQL**, no PostgreSQL. Se revisó la estructura exportada; no se hizo una importación real en Railway porque todavía no hay un destino conectado.

## Importación desde Windows

1. Crear un servicio MySQL en Railway y usar una base **vacía**.
2. En el servicio MySQL, habilitar acceso público TCP para importar desde la computadora. Obtener el **host público y puerto público** de la conexión externa. No usar el hostname privado de Railway desde Windows.
3. Abrir PowerShell y ejecutar este comando reemplazando los marcadores con los datos de Railway:

```powershell
& 'C:\xampp\mysql\bin\mysql.exe' --protocol=TCP --host=HOST_PUBLICO --port=PUERTO_PUBLICO --user=USUARIO --password --database=BASE_DESTINO --default-character-set=utf8mb4
```

`--password` solicita la contraseña sin escribirla dentro del comando. Una vez dentro del cliente MySQL, importar el archivo usando su nombre real:

```sql
SOURCE C:/Users/tomat/LogIn - R5/database/exports/petcare-railway-2026-09-18T19-57-41-849Z.sql;
SHOW TABLES;
```

La ruta de SOURCE debe ir sin comillas en el cliente mysql, usando barras `/`. Reemplazar `ARCHIVO_EXPORTADO.sql` por el archivo real de esta carpeta. El SQL se aplica a la base seleccionada con `--database`; no intenta crear ni seleccionar `petcare` por su cuenta. Ejecutarlo **una sola vez** y comprobar que no aparezcan errores; si falla, no continuar como si hubiera finalizado correctamente ni usar `--force`.

También se puede abrir el archivo SQL en MySQL Workbench, seleccionar la base vacía de Railway y ejecutarlo allí. Verificar las tablas y sus cantidades con el manifiesto. La base de origen no cambia al importar la copia.

Documentación: [MySQL y acceso externo en Railway](https://docs.railway.com/databases/mysql).

## Conectar el backend

Conservar los nombres usados por el proyecto:

| Variable PetCare | Dato del servicio MySQL Railway |
|---|---|
| DB_HOST | MYSQLHOST si backend y BD comparten red privada; host TCP público para conexión externa |
| DB_PORT | MYSQLPORT en privado; puerto TCP público para conexión externa |
| DB_USER | MYSQLUSER |
| DB_PASSWORD | MYSQLPASSWORD |
| DB_NAME | MYSQLDATABASE |

No guardar estas credenciales en variables `VITE_`: solo el backend accede a MySQL. Mantener también JWT_SECRET y las variables OAuth actuales, ajustando las URLs públicas y callbacks al dominio final. El frontend sigue usando VITE_API_URL.

## Fotos

Las fotos son archivos, no contenido binario dentro del SQL. `exports/petcare-fotos.zip` contiene la carpeta `mascotas/` actual. Extraer esa carpeta dentro del directorio persistente que el backend use como UPLOADS_DIR. Las URLs `/uploads/mascotas/...` de la base se conservarán si los archivos permanecen con sus nombres originales.

## Repetir la exportación

Si agregás datos después de generar el archivo, crear una copia actualizada:

```powershell
npm.cmd --prefix backend run export:railway
```

El script lee `backend/.env`, crea un nuevo archivo fechado y su manifiesto; no sobrescribe exports anteriores. Usa el mysqldump de XAMPP en Windows. Si está en otra ubicación, definir `MYSQLDUMP_PATH` antes de ejecutarlo. No imprime credenciales. No realiza la importación por sí solo.

## Limpieza realizada

Se eliminaron `.refactor-baseline/`, las tres carpetas `src-backups/`, `dist/`, `frontend-usestate/dist/`, `frontend-usestate/node_modules/`, el log de lint anterior, dos SVG de plantilla, `public/icons.svg` y el alias sin referencias `src/pages/AdminPage.tsx`.

Se conservaron frontend principal, frontend useState, backend, pruebas, migración OAuth, utilidades de mantenimiento, documentación, configuraciones, dependencias del frontend principal/backend y todas las fotos. Las dependencias de la variante se regeneran con `npm install` en su carpeta. Los builds se regeneran con `npm run build`.

## Resultado de verificación posterior

El build del frontend, la comprobación de sintaxis del backend y todos los tests aislados pasaron. Lint conserva 5 errores y 5 advertencias anteriores en el código activo; los otros 6 errores desaparecieron al eliminar backups. El build generado para verificar se volvió a quitar al terminar. Los recuentos del SQL coinciden con la base de origen: 14 tablas y 32 filas. No se modificaron datos locales ni se ejecutó una importación en Railway.
