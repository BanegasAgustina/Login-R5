import { USER_TYPES } from '../auth/userTypes.js';
import { Router } from 'express';
//este archivo es el encargado de conectar el panel de administración 
// del frontend con la base de datos, permitiendo que el administrador 
// consulte y gestione usuarios, mascotas y 
// turnos de PetCare de forma controlada y segura.
// Importamos las funciones de express-validator para validar
// los parámetros, consultas y datos recibidos en las peticiones.
import { body, param, query, validationResult } from 'express-validator';

// Importamos la conexión con la base de datos.
import { pool } from '../config/database.js';
import { listRoles, roleExists } from '../repositories/roleRepository.js';

// Importamos el middleware de autenticación y la función
// que permite restringir el acceso según el rol del usuario.
import { authMiddleware, allowRoles } from '../middleware/auth.js';

// Importamos una función que elimina información sensible
// antes de enviar los datos del usuario al frontend.
import { publicUser } from '../utils/sanitize.js';

// Creamos un Router de Express para agrupar las rutas
// relacionadas con la administración.
const router = Router();

// Función que comprueba si las validaciones realizadas
// anteriormente encontraron algún error.
const validate = (req, res, next) => {
  const errors = validationResult(req);

  // Si no hay errores continúa con la petición.
// Si hay errores devuelve un código 400 y el primer mensaje de error.
  return errors.isEmpty()
    ? next()
    : res.status(400).json({ message: errors.array()[0].msg });
};

// Todas las rutas de este router requieren:
// 1. Que el usuario esté autenticado.
// 2. Que tenga el rol de "Administrador".
router.use(authMiddleware, allowRoles(USER_TYPES.ADMIN));

router.get('/roles', async (_req, res, next) => {
  try { return res.json(await listRoles()); } catch (error) { return next(error); }
});

// Expresión regular para validar nombres y apellidos.
// Permite letras, espacios, guiones, apóstrofes y letras con tildes.
const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;

// Expresión regular para validar que el email tenga
// un formato y un dominio válido.
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;


// GET /api/admin/usuarios
// Devuelve un listado de usuarios con búsqueda, filtros y ordenamiento.
router.get(
  '/usuarios',

  // Validamos los diferentes filtros que puede recibir la petición.
  [
    query('q').optional().trim(),
    query('rol').optional().trim(),
    query('estado').optional().trim(),
    query('mascotas').optional().trim(),

    // El ordenamiento solamente puede utilizar una de estas opciones.
    query('sort').optional().isIn([
      'nombre_asc',
      'nombre_desc',
      'recientes',
      'antiguos'
    ]),
  ],

  // Ejecutamos la función de validación.
  validate,

  // Función que procesa la petición.
  async (req, res, next) => {
    try {

      // Consulta inicial para obtener los usuarios.
      // También obtiene su rol, estado y cantidad de mascotas.
      let sql = `SELECT u.id, u.nombre, u.apellido, u.email, u.rol_id, u.estado_id, u.fecha_creacion,
                        r.nombre AS rol,
                        CASE WHEN u.estado_id = 1 THEN 'Activo' ELSE 'Inactivo' END AS estado,
                        GROUP_CONCAT(m.nombre ORDER BY m.nombre SEPARATOR ', ') AS mascotas_str,
                        COUNT(m.id) AS total_mascotas
                 FROM usuarios u
                 JOIN roles r ON r.id = u.rol_id
                 LEFT JOIN clientes c ON c.usuario_id = u.id
                 LEFT JOIN mascotas m ON m.cliente_id = c.id AND COALESCE(m.activo, 1) = 1
                 WHERE 1=1`;

      // Array donde se almacenan los valores que se enviarán
      // como parámetros de la consulta SQL.
      const params = [];

      // Si el administrador ingresó un texto de búsqueda,
      // buscamos coincidencias en nombre, apellido o email.
      if (req.query.q) {
        sql += ' AND (u.nombre LIKE ? OR u.apellido LIKE ? OR u.email LIKE ?)';

        const term = `%${req.query.q}%`;

        params.push(term, term, term);
      }

      // Si se seleccionó un rol, filtramos por ese rol.
      if (req.query.rol) {
        sql += ' AND r.nombre = ?';
        params.push(req.query.rol);
      }

      // Si se seleccionó un estado, lo convertimos a su ID.
      if (req.query.estado) {
        const estadoId = req.query.estado === 'Activo' ? 1 : 2;

        sql += ' AND u.estado_id = ?';
        params.push(estadoId);
      }

      // Agrupamos los resultados por usuario para poder
      // utilizar COUNT y GROUP_CONCAT.
      sql += ' GROUP BY u.id';

      // Filtramos usuarios que tengan al menos una mascota.
      if (req.query.mascotas === 'con') {
        sql += ' HAVING total_mascotas > 0';

      // Filtramos usuarios que no tengan mascotas.
      } else if (req.query.mascotas === 'sin') {
        sql += ' HAVING total_mascotas = 0';
      }

      // La opción llega validada y se traduce a SQL fijo para evitar inyección.
      const userOrder = {
        nombre_asc: 'u.nombre ASC, u.apellido ASC',
        nombre_desc: 'u.nombre DESC, u.apellido DESC',
        antiguos: 'u.fecha_creacion ASC, u.id ASC',
        recientes: 'u.fecha_creacion DESC, u.id DESC',
      };

      // Aplicamos el orden elegido.
      // Si no se especifica ninguno, se muestran primero los más recientes.
      sql += ` ORDER BY ${userOrder[req.query.sort] || userOrder.recientes}`;

      // Ejecutamos la consulta en la base de datos.
      const [rows] = await pool.query(sql, params);

      // Devolvemos los usuarios aplicando publicUser
      // para evitar enviar información sensible.
      return res.json(rows.map(publicUser));

    } catch (error) {

      // Si ocurre un error, lo enviamos al middleware
      // encargado del manejo de errores.
      return next(error);
    }
  },
);


// GET /api/admin/usuarios/:id
// Obtiene la información de un usuario específico.
router.get(
  '/usuarios/:id',

  // Verificamos que el ID recibido sea un número entero.
  [param('id').isInt()],

  validate,

  async (req, res, next) => {
    try {

      // Buscamos el usuario por su ID y obtenemos
      // también su rol, estado y mascotas.
      const [rows] = await pool.query(
        `SELECT u.*, r.nombre AS rol,
                CASE WHEN u.estado_id = 1 THEN 'Activo' ELSE 'Inactivo' END AS estado,
                GROUP_CONCAT(m.nombre ORDER BY m.nombre SEPARATOR ', ') AS mascotas_str,
                COUNT(m.id) AS total_mascotas
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_id
         LEFT JOIN clientes c ON c.usuario_id = u.id
         LEFT JOIN mascotas m ON m.cliente_id = c.id AND COALESCE(m.activo, 1) = 1
         WHERE u.id = ?
         GROUP BY u.id`,
        [req.params.id],
      );

      // Si no existe el usuario, devolvemos un error 404.
      if (!rows[0])
        return res.status(404).json({ message: 'Usuario no encontrado.' });

      // Devolvemos los datos del usuario.
      return res.json(publicUser(rows[0]));

    } catch (error) {
      return next(error);
    }
  }
);


// PUT /api/admin/usuarios/:id
// Permite modificar los datos administrativos de un usuario.
router.put(
  '/usuarios/:id',

  // Validaciones de los datos recibidos.
  [
    param('id').isInt(),

    // Validación del nombre.
    body('nombre')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('El nombre no puede estar vacío.')
      .custom((value) => {

        // Comprobamos que no tenga números.
        if (/\d/.test(value))
          throw new Error('El nombre no puede contener números.');

        // Comprobamos que solamente tenga caracteres permitidos.
        if (!NAME_REGEX.test(value))
          throw new Error('El nombre solo puede contener letras y espacios.');

        return true;
      }),

    // Validación del apellido.
    body('apellido')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('El apellido no puede estar vacío.')
      .custom((value) => {

        if (/\d/.test(value))
          throw new Error('El apellido no puede contener números.');

        if (!NAME_REGEX.test(value))
          throw new Error('El apellido solo puede contener letras y espacios.');

        return true;
      }),

    // Validación del email.
    body('email')
      .optional()
      .isEmail()
      .withMessage('Ingresá un email válido.')
      .normalizeEmail()
      .custom((value) => {

        if (!EMAIL_REGEX.test(value))
          throw new Error('Ingresá un email con un dominio completo válido.');

        return true;
      }),

    // El tipo debe existir en el catálogo; no se presupone su ID.
    body('rol_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Rol inválido.'),
  ],

  validate,

  async (req, res, next) => {
    try {

      // Extraemos los datos que se quieren modificar.
      const { nombre, apellido, email, rol_id } = req.body;

      // Guardará las partes de la consulta SQL que se van a modificar.
      const fields = [];

      // Guardará los valores correspondientes a los signos ?.
      const params = [];

      // Si se recibió un nombre, lo agregamos a la actualización.
      if (nombre) {
        fields.push('nombre = ?');
        params.push(nombre);
      }

      // Si se recibió un apellido, lo agregamos a la actualización.
      if (apellido) {
        fields.push('apellido = ?');
        params.push(apellido);
      }

      // Si se recibió un email, comprobamos primero que no esté
      // siendo utilizado por otro usuario.
      if (email) {
        const [exists] = await pool.query(
          'SELECT id FROM usuarios WHERE email = ? AND id != ?',
          [email, req.params.id]
        );

        // Si ya existe, devolvemos un conflicto.
        if (exists.length)
          return res.status(409).json({ message: 'Ese email ya está en uso.' });

        fields.push('email = ?');
        params.push(email);
      }

      // Si se recibió un rol, lo agregamos a la actualización.
      if (rol_id) {
        if (!(await roleExists(rol_id))) return res.status(400).json({ message: 'Rol inválido.' });
        fields.push('rol_id = ?');
        params.push(rol_id);
      }

      // Si no se recibió ningún dato, no hay nada para actualizar.
      if (!fields.length)
        return res.status(400).json({ message: 'No hay datos para actualizar.' });

      // Agregamos el ID del usuario al final de los parámetros.
      params.push(req.params.id);

      // Ejecutamos la actualización.
      const [result] = await pool.query(
        `UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`,
        params
      );

      // Si no se modificó ningún usuario, significa que no existe.
      if (!result.affectedRows)
        return res.status(404).json({ message: 'Usuario no encontrado.' });

      // Devolvemos un mensaje de confirmación.
      return res.json({ message: 'Usuario actualizado correctamente.' });

    } catch (error) {
      return next(error);
    }
  },
);


// PATCH /api/admin/usuarios/:id/estado
// Activa o desactiva una cuenta de usuario.
router.patch(
  '/usuarios/:id/estado',

  // Validamos el ID del usuario y el estado.
  [
    param('id').isInt(),
    body('estado_id').isInt({ min: 1, max: 2 })
  ],

  validate,

  async (req, res, next) => {
    try {

      // Evitamos que el administrador pueda desactivar
      // o modificar el estado de su propia cuenta.
      if (Number(req.params.id) === req.user.id) {
        return res.status(400).json({
          message: 'No podés cambiar el estado de tu propia cuenta.'
        });
      }

      // Actualizamos el estado del usuario.
      const [result] = await pool.query(
        'UPDATE usuarios SET estado_id = ? WHERE id = ?',
        [
          req.body.estado_id,
          req.params.id,
        ],
      );

      // Si no se encontró el usuario, devolvemos 404.
      if (!result.affectedRows)
        return res.status(404).json({ message: 'Usuario no encontrado.' });

      return res.json({ message: 'Estado actualizado correctamente.' });

    } catch (error) {
      return next(error);
    }
  },
);


// DELETE /api/admin/usuarios/:id
// Elimina un usuario teniendo en cuenta diferentes condiciones de seguridad.
router.delete(
  '/usuarios/:id',

  // Verificamos que el ID sea válido.
  [param('id').isInt()],

  validate,

  async (req, res, next) => {
    try {

      // Evitamos que el administrador pueda eliminar su propia cuenta.
      if (Number(req.params.id) === req.user.id) {
        return res.status(400).json({
          message: 'No podés eliminar tu propia cuenta.'
        });
      }

      // Comprobamos si el usuario existe.
      const [rows] = await pool.query(
        'SELECT id, nombre, apellido FROM usuarios WHERE id = ?',
        [req.params.id]
      );

      if (!rows.length)
        return res.status(404).json({ message: 'Usuario no encontrado.' });

      try {

        // Intentamos eliminar primero los registros relacionados
        // con clientes y veterinarios.
        await pool.query(
          'DELETE FROM clientes WHERE usuario_id = ?',
          [req.params.id]
        );

        await pool.query(
          'DELETE FROM veterinarios WHERE usuario_id = ?',
          [req.params.id]
        );

        // Finalmente eliminamos el usuario.
        const [delResult] = await pool.query(
          'DELETE FROM usuarios WHERE id = ?',
          [req.params.id]
        );

        if (!delResult.affectedRows)
          return res.status(404).json({ message: 'Usuario no encontrado.' });

        return res.json({
          message: 'Usuario eliminado correctamente.'
        });

      } catch (dbErr) {

        // Si la base de datos indica que existen registros relacionados,
        // evitamos eliminar el usuario.
        if (
          dbErr.code === 'ER_ROW_IS_REFERENCED_2' ||
          dbErr.errno === 1451
        ) {
          return res.status(409).json({
            message: 'No se puede eliminar el usuario porque tiene mascotas o turnos asociados. Te recomendamos desactivarlo.',
          });
        }

        throw dbErr;
      }

    } catch (error) {
      return next(error);
    }
  },
);


// GET /api/admin/mascotas
// Obtiene todas las mascotas junto con la información de su propietario.
//
// Filtros:
// q = búsqueda
// especie = filtrar por especie
// activo = 1 activas, 0 inactivas, vacío todas
router.get(
  '/mascotas',

  // Validamos los filtros recibidos.
  [
    query('q').optional().trim(),
    query('especie').optional().trim(),
    query('activo').optional().isIn(['0', '1', '']).trim(),

    query('sort').optional().isIn([
      'nombre_asc',
      'nombre_desc',
      'recientes',
      'antiguos',
      'edad_desc',
      'edad_asc'
    ]),
  ],

  validate,

  async (req, res, next) => {
    try {

      // Consulta que obtiene las mascotas y sus datos relacionados:
      // especie, raza, propietario y estado.
      let sql = `SELECT m.id, m.nombre, m.fecha_nacimiento, m.sexo, m.peso, m.foto_url,
                        m.activo,
                        e.nombre AS especie, r.nombre AS raza,
                        CONCAT(u.nombre, ' ', u.apellido) AS propietario,
                        CASE WHEN u.estado_id = 1 THEN 'Activo' ELSE 'Inactivo' END AS estado
                 FROM mascotas m
                 JOIN especies e ON e.id = m.especie_id
                 LEFT JOIN razas r ON r.id = m.raza_id
                 JOIN clientes c ON c.id = m.cliente_id
                 JOIN usuarios u ON u.id = c.usuario_id
                 WHERE 1=1`;

      // Parámetros utilizados para los valores de la consulta.
      const params = [];

      // Búsqueda por nombre de mascota, especie, raza o propietario.
      if (req.query.q) {
        sql += " AND (m.nombre LIKE ? OR e.nombre LIKE ? OR r.nombre LIKE ? OR u.nombre LIKE ? OR u.apellido LIKE ? OR CONCAT(u.nombre, ' ', u.apellido) LIKE ? OR u.email LIKE ?)";

        const term = `%${req.query.q}%`;

        params.push(
          term,
          term,
          term,
          term,
          term,
          term,
          term
        );
      }

      // Filtramos por especie.
      if (req.query.especie) {
        sql += ' AND e.nombre = ?';
        params.push(req.query.especie);
      }

      // Filtro de mascotas activas o inactivas.
      if (req.query.activo === '1') {
        sql += ' AND m.activo = 1';
      } else if (req.query.activo === '0') {
        sql += ' AND m.activo = 0';
      }

      // Se utilizan nombres de columnas definidos previamente
      // para evitar que el usuario pueda introducir SQL directamente.
      const petOrder = {
        nombre_asc: 'm.nombre ASC, m.id ASC',
        nombre_desc: 'm.nombre DESC, m.id DESC',
        recientes: 'm.id DESC',
        antiguos: 'm.id ASC',
        edad_desc: 'm.fecha_nacimiento ASC, m.id ASC',
        edad_asc: 'm.fecha_nacimiento DESC, m.id ASC',
      };

      // Aplicamos el orden seleccionado.
      // Por defecto se muestran primero las mascotas activas.
      sql += ` ORDER BY ${petOrder[req.query.sort] || 'm.activo DESC, m.id DESC'}`;

      // Ejecutamos la consulta.
      const [rows] = await pool.query(sql, params);

      // Enviamos las mascotas al frontend.
      return res.json(rows);

    } catch (error) {
      return next(error);
    }
  },
);


// GET /api/admin/turnos
// Obtiene los turnos pendientes o los turnos según los filtros.
router.get(
  '/turnos',

  // Validamos los filtros de estado, fecha y veterinario.
  [
    query('estado').optional().trim(),
    query('fecha').optional().isISO8601(),
    query('veterinario').optional().trim(),
  ],

  validate,

  async (req, res, next) => {
    try {

      // Consulta para obtener los turnos junto con
      // mascota, propietario, veterinario y estado.
      let sql = `SELECT t.id, t.fecha, t.hora, t.motivo, et.nombre AS estado,
                        m.nombre AS mascota,
                        CONCAT(uc.nombre, ' ', uc.apellido) AS propietario,
                        CONCAT(uv.nombre, ' ', uv.apellido) AS veterinario
                 FROM turnos t
                 JOIN mascotas m ON m.id = t.mascota_id
                 JOIN clientes c ON c.id = m.cliente_id
                 JOIN usuarios uc ON uc.id = c.usuario_id
                 JOIN veterinarios v ON v.id = t.veterinario_id
                 JOIN usuarios uv ON uv.id = v.usuario_id
                 JOIN estados_turno et ON et.id = t.estado_id
                 WHERE 1=1`;

      const params = [];

      // Si se especifica un estado, filtramos por él.
      if (req.query.estado) {
        sql += ' AND et.nombre = ?';
        params.push(req.query.estado);

      // Si no se especifica, solamente mostramos
      // turnos pendientes o confirmados.
      } else {
        sql += " AND et.nombre IN ('Pendiente', 'Confirmado')";
      }

      // Si se especifica una fecha, filtramos los turnos de ese día.
      if (req.query.fecha) {
        sql += ' AND t.fecha = ?';
        params.push(req.query.fecha);
      }

      // Si se especifica un veterinario, buscamos por nombre o apellido.
      if (req.query.veterinario) {
        sql += ' AND (uv.nombre LIKE ? OR uv.apellido LIKE ?)';

        const term = `%${req.query.veterinario}%`;

        params.push(term, term);
      }

      // Ordenamos los turnos por fecha y hora.
      sql += ' ORDER BY t.fecha, t.hora';

      // Ejecutamos la consulta.
      const [rows] = await pool.query(sql, params);

      // Devolvemos los turnos.
      return res.json(rows);

    } catch (error) {
      return next(error);
    }
  },
);


// GET /api/admin/turnos/:id
// Obtiene información detallada de un turno específico.
router.get(
  '/turnos/:id',

  // Validamos que el ID sea un número entero.
  [param('id').isInt()],

  validate,

  async (req, res, next) => {
    try {

      // Consulta que obtiene toda la información del turno:
      // mascota, propietario, veterinario, especie, raza,
      // teléfono, email y matrícula.
      const [rows] = await pool.query(
        `SELECT t.*, et.nombre AS estado, m.nombre AS mascota,
                e.nombre AS especie, r.nombre AS raza,
                CONCAT(uc.nombre, ' ', uc.apellido) AS propietario, uc.email AS email_propietario,
                c.telefono AS telefono_propietario,
                CONCAT(uv.nombre, ' ', uv.apellido) AS veterinario, v.matricula
         FROM turnos t
         JOIN mascotas m ON m.id = t.mascota_id
         JOIN especies e ON e.id = m.especie_id
         LEFT JOIN razas r ON r.id = m.raza_id
         JOIN clientes c ON c.id = m.cliente_id
         JOIN usuarios uc ON uc.id = c.usuario_id
         JOIN veterinarios v ON v.id = t.veterinario_id
         JOIN usuarios uv ON uv.id = v.usuario_id
         JOIN estados_turno et ON et.id = t.estado_id
         WHERE t.id = ?`,
        [req.params.id],
      );

      // Si el turno no existe, devolvemos un error 404.
      if (!rows[0])
        return res.status(404).json({ message: 'Turno no encontrado.' });

      // Devolvemos el detalle del turno.
      return res.json(rows[0]);

    } catch (error) {
      return next(error);
    }
  }
);


// GET /api/admin/resumen
// Obtiene los conteos principales que se muestran en el dashboard.
router.get('/resumen', async (_req, res, next) => {
  try {

    // Cuenta la cantidad total de usuarios.
    const [[usuarios]] = await pool.query(
      'SELECT COUNT(*) AS total FROM usuarios'
    );

    // Cuenta la cantidad total de mascotas.
    const [[mascotas]] = await pool.query(
      'SELECT COUNT(*) AS total FROM mascotas'
    );

    // Cuenta la cantidad total de veterinarios.
    const [[veterinarios]] = await pool.query(
      'SELECT COUNT(*) AS total FROM veterinarios'
    );

    // Cuenta los turnos que están pendientes o confirmados.
    const [[turnosPendientes]] = await pool.query(
      `SELECT COUNT(*) AS total FROM turnos t
       JOIN estados_turno e ON e.id = t.estado_id
       WHERE e.nombre IN ('Pendiente', 'Confirmado')`,
    );

    // Devolvemos todas las estadísticas juntas en un objeto.
    return res.json({
      usuarios: usuarios.total,
      mascotas: mascotas.total,
      veterinarios: veterinarios.total,
      turnosPendientes: turnosPendientes.total,
    });

  } catch (error) {
    return next(error);
  }
});


// Exportamos el router para poder utilizar estas rutas
// desde el archivo principal del servidor.
export default router;