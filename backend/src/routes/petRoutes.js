import { USER_TYPES, hasUserType } from '../auth/userTypes.js';
import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { pool } from '../config/database.js';
import { authMiddleware, allowRoles } from '../middleware/auth.js';
//este archivo contiene las rutas de la API relacionadas con mascotas,
//  turnos y veterinarios.
const router = Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  return errors.isEmpty() ? next() : res.status(400).json({ message: errors.array()[0].msg });
};

// Busca el id interno del cliente usando el id de usuario del JWT.
async function getClientId(userId) {
  const [rows] = await pool.query('SELECT id FROM clientes WHERE usuario_id = ?', [userId]);
  return rows[0]?.id;
}

async function getVetId(userId) {
  const [rows] = await pool.query('SELECT id FROM veterinarios WHERE usuario_id = ?', [userId]);
  return rows[0]?.id;
}

// Convierte el texto de raza en una clave del catálogo para conservar el modelo relacional.
async function resolveBreedId(especieId, raza) {
  if (!raza?.trim()) return null;
  const nombre = raza.trim();
  const [existing] = await pool.query(
    'SELECT id FROM razas WHERE especie_id = ? AND LOWER(nombre) = LOWER(?) LIMIT 1',
    [especieId, nombre],
  );
  if (existing[0]) return existing[0].id;
  const [result] = await pool.query('INSERT INTO razas (especie_id, nombre) VALUES (?, ?)', [especieId, nombre]);
  return result.insertId;
}
// GET /api/mascotas
// Cliente: ve únicamente sus mascotas activas. Veterinario: consulta todas las activas
// junto con el dueño. La autorización se resuelve en SQL, no en la interfaz.
router.get('/mascotas', authMiddleware, async (req, res, next) => {
  try {
    let sql = `SELECT m.*, e.nombre AS especie, r.nombre AS raza,
                      CONCAT(u.nombre, ' ', u.apellido) AS propietario, u.email AS email_propietario
               FROM mascotas m
               JOIN especies e ON e.id = m.especie_id
               LEFT JOIN razas r ON r.id = m.raza_id
               JOIN clientes c ON c.id = m.cliente_id
               JOIN usuarios u ON u.id = c.usuario_id`;
    const params = [];
// La cláusula WHERE se ajusta según el rol del usuario autenticado.
    if (hasUserType(req.user, USER_TYPES.CLIENT)) {
      const clientId = await getClientId(req.user.id);
      sql += ' WHERE m.cliente_id = ? AND COALESCE(m.activo, 1) = 1';
      params.push(clientId);
    } else if (hasUserType(req.user, USER_TYPES.VET)) {
      // No se filtra por turnos: todos los veterinarios ven el mismo padrón activo.
      sql += ' WHERE COALESCE(m.activo, 1) = 1';
    } else {
      return res.status(403).json({ message: 'No tenés permiso para consultar mascotas desde este endpoint.' });
    }

    sql += ' ORDER BY m.nombre ASC, m.id ASC';
    const [pets] = await pool.query(sql, params);
    return res.json(pets);
  } catch (error) {
    return next(error);
  }
});
// GET /api/mascotas/:id/detalle — vista clínica, sin facultades de modificación.
router.get('/mascotas/:id/detalle', authMiddleware, allowRoles(USER_TYPES.VET), [param('id').isInt()], validate, async (req, res, next) => {
  try {
    const [pets] = await pool.query(
      `SELECT m.*, e.nombre AS especie, r.nombre AS raza,
              CONCAT(u.nombre, ' ', u.apellido) AS propietario, u.email AS email_propietario
       FROM mascotas m
       JOIN especies e ON e.id = m.especie_id
       LEFT JOIN razas r ON r.id = m.raza_id
       JOIN clientes c ON c.id = m.cliente_id
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE m.id = ? AND COALESCE(m.activo, 1) = 1`,
      [req.params.id],
    );
    if (!pets[0]) return res.status(404).json({ message: 'Mascota activa no encontrada.' });

    // Una segunda consulta acotada evita N+1: solo se piden turnos al abrir un detalle.
    const [turnos] = await pool.query(
      `SELECT t.id, t.fecha, t.hora, t.motivo, et.nombre AS estado,
              CONCAT(uv.nombre, ' ', uv.apellido) AS veterinario
       FROM turnos t
       JOIN estados_turno et ON et.id = t.estado_id
       JOIN veterinarios v ON v.id = t.veterinario_id
       JOIN usuarios uv ON uv.id = v.usuario_id
       WHERE t.mascota_id = ?
       ORDER BY t.fecha DESC, t.hora DESC`,
      [req.params.id],
    );
    return res.json({ mascota: pets[0], turnos });
  } catch (error) {
    return next(error);
  }
});
// POST /api/mascotas — registrar nueva mascota (activo = 1 por defecto).
router.post(
  '/mascotas',
  authMiddleware,
  allowRoles(USER_TYPES.CLIENT),
  [
    body('nombre')
      .trim()
      .notEmpty()
      .withMessage('El nombre de la mascota es obligatorio.')
      .isLength({ min: 2, max: 80 })
      .withMessage('El nombre debe tener entre 2 y 80 caracteres.')
      .custom((value) => {
        if (!/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s'-]+$/.test(value)) {
          throw new Error('El nombre de la mascota no puede contener símbolos extraños.');
        }
        return true;
      }),
    body('especie_id').isInt().withMessage('Seleccioná una especie válida.'),
    body('raza').optional({ checkFalsy: true }).trim().isLength({ max: 80 }).withMessage('La raza no puede exceder los 80 caracteres.'),
    body('sexo').isIn(['Macho', 'Hembra']).withMessage('Sexo inválido.'),
    body('peso').optional({ checkFalsy: true }).isFloat({ min: 0.1, max: 300 }).withMessage('El peso debe ser un número válido.'),
    body('foto_url')
      .optional({ nullable: true })
      .custom((value) => {
        if (value && typeof value === 'string' && !value.startsWith('/uploads/') && !value.startsWith('http')) {
          throw new Error('URL de imagen inválida.');
        }
        return true;
      }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const clientId = await getClientId(req.user.id);
      const { nombre, especie_id, raza, fecha_nacimiento, sexo, peso, foto_url } = req.body;
      const raza_id = await resolveBreedId(especie_id, raza);
      const [result] = await pool.query(
        `INSERT INTO mascotas(cliente_id, nombre, especie_id, raza_id, fecha_nacimiento, sexo, peso, foto_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [clientId, nombre.trim(), especie_id, raza_id || null, fecha_nacimiento || null, sexo, peso || null, foto_url || null],
      );
      return res.status(201).json({ id: result.insertId, message: 'Mascota registrada correctamente.' });
    } catch (error) {
      return next(error);
    }
  },
);

// PATCH /api/mascotas/:id/deactivate — eliminación lógica (soft delete): activo = 0.
router.patch(
  '/mascotas/:id/deactivate',
  authMiddleware,
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      let result;

      if (hasUserType(req.user, USER_TYPES.ADMIN)) {
        [result] = await pool.query(
          'UPDATE mascotas SET activo = 0 WHERE id = ?',
          [req.params.id],
        );
      } else {
        const clientId = await getClientId(req.user.id);
        if (!clientId) return res.status(403).json({ message: 'No tenés permiso para esta acción.' });
        [result] = await pool.query(
          'UPDATE mascotas SET activo = 0 WHERE id = ? AND cliente_id = ?',
          [req.params.id, clientId],
        );
      }

      if (!result.affectedRows) {
        return res.status(404).json({ message: 'Mascota no encontrada o sin permiso.' });
      }
      return res.json({ message: 'Mascota removida del listado correctamente.' });
    } catch (error) {
      return next(error);
    }
  },
);

// PUT /api/mascotas/:id — edición de una mascota propia y activa.
router.put(
  '/mascotas/:id',
  authMiddleware,
  allowRoles(USER_TYPES.CLIENT),
  [
    param('id').isInt(),
    body('nombre').trim().isLength({ min: 2, max: 80 }).withMessage('El nombre debe tener entre 2 y 80 caracteres.'),
    body('especie_id').isInt().withMessage('Seleccioná una especie válida.'),
    body('raza').optional({ checkFalsy: true }).trim().isLength({ max: 80 }).withMessage('La raza no puede exceder los 80 caracteres.'),
    body('sexo').isIn(['Macho', 'Hembra']).withMessage('Sexo inválido.'),
    body('peso').optional({ checkFalsy: true }).isFloat({ min: 0.1, max: 300 }).withMessage('El peso debe ser un número válido.'),
    body('foto_url').optional({ nullable: true }).custom((value) => {
      if (value && typeof value === 'string' && !value.startsWith('/uploads/') && !value.startsWith('http')) {
        throw new Error('URL de imagen inválida.');
      }
      return true;
    }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const clientId = await getClientId(req.user.id);
      const { nombre, especie_id, raza, fecha_nacimiento, sexo, peso, foto_url } = req.body;
      const raza_id = await resolveBreedId(especie_id, raza);
      const [result] = await pool.query(
        `UPDATE mascotas
         SET nombre = ?, especie_id = ?, raza_id = ?, fecha_nacimiento = ?, sexo = ?, peso = ?, foto_url = ?
         WHERE id = ? AND cliente_id = ? AND activo = 1`,
        [nombre.trim(), especie_id, raza_id || null, fecha_nacimiento || null, sexo, peso || null, foto_url || null, req.params.id, clientId],
      );
      if (!result.affectedRows) return res.status(404).json({ message: 'Mascota no encontrada o sin permiso.' });
      return res.json({ message: 'Mascota actualizada correctamente.' });
    } catch (error) {
      return next(error);
    }
  },
);

// DELETE heredado: conserva el historial aplicando la misma baja lógica.
router.delete('/mascotas/:id', authMiddleware, [param('id').isInt()], validate, async (req, res, next) => {
  try {
    const clientId = await getClientId(req.user.id);
    const [result] = await pool.query(
      'UPDATE mascotas SET activo = 0 WHERE id = ? AND (cliente_id = ? OR ? = TRUE)',
      [req.params.id, clientId, hasUserType(req.user, USER_TYPES.ADMIN)],
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Mascota no encontrada o sin permiso.' });
    return res.json({ message: 'Mascota removida del listado correctamente.' });
  } catch (error) {
    return next(error);
  }
});
router.get('/veterinarios', authMiddleware, async (_req, res, next) => {
  try {
    const [vets] = await pool.query(
      `SELECT v.id, u.nombre, u.apellido, v.matricula, e.nombre AS especialidad
       FROM veterinarios v JOIN usuarios u ON u.id = v.usuario_id
       LEFT JOIN especialidades e ON e.id = v.especialidad_id`,
    );
    return res.json(vets);
  } catch (error) {
    return next(error);
  }
});

router.get('/especies', authMiddleware, async (_req, res, next) => {
  try {
    const [species] = await pool.query('SELECT * FROM especies');
    return res.json(species);
  } catch (error) {
    return next(error);
  }
});

// GET /api/razas?especie_id= — sugerencias para el campo de texto del formulario.
router.get('/razas', authMiddleware, [query('especie_id').isInt()], validate, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, nombre FROM razas WHERE especie_id = ? ORDER BY nombre', [req.query.especie_id]);
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});
// GET /api/pacientes — alias histórico del padrón activo visible para veterinarios.
router.get('/pacientes', authMiddleware, allowRoles(USER_TYPES.VET), async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT m.*, e.nombre AS especie, r.nombre AS raza,
              CONCAT(u.nombre, ' ', u.apellido) AS propietario, u.email AS email_propietario
       FROM mascotas m
       JOIN especies e ON e.id = m.especie_id
       LEFT JOIN razas r ON r.id = m.raza_id
       JOIN clientes c ON c.id = m.cliente_id
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE COALESCE(m.activo, 1) = 1
       ORDER BY m.nombre ASC, m.id ASC`,
    );
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});
// GET /api/turnos
router.get('/turnos', authMiddleware, async (req, res, next) => {
  try {
    let sql = `SELECT t.*, m.nombre AS mascota, CONCAT(u.nombre, ' ', u.apellido) AS veterinario,
                      CONCAT(uc.nombre, ' ', uc.apellido) AS cliente,
                      et.nombre AS estado
               FROM turnos t
               JOIN mascotas m ON m.id = t.mascota_id
               JOIN veterinarios v ON v.id = t.veterinario_id
               JOIN usuarios u ON u.id = v.usuario_id
               JOIN clientes c ON c.id = m.cliente_id
               JOIN usuarios uc ON uc.id = c.usuario_id
               JOIN estados_turno et ON et.id = t.estado_id`;
    let params = [];

    if (hasUserType(req.user, USER_TYPES.CLIENT)) {
      sql += ' WHERE c.usuario_id = ?';
      params = [req.user.id];
    } else if (hasUserType(req.user, USER_TYPES.VET)) {
      sql += ' WHERE v.usuario_id = ?';
      params = [req.user.id];
    }

    if (req.query.fecha) {
      sql += params.length ? ' AND t.fecha = ?' : ' WHERE t.fecha = ?';
      params.push(req.query.fecha);
    }

    sql += ' ORDER BY t.fecha, t.hora';
    const [appointments] = await pool.query(sql, params);
    return res.json(appointments);
  } catch (error) {
    return next(error);
  }
});

// GET /api/turnos/hoy — agenda del día para veterinarios.
router.get('/turnos/hoy', authMiddleware, allowRoles(USER_TYPES.VET), async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [rows] = await pool.query(
      `SELECT t.id, t.fecha, t.hora, t.motivo, m.nombre AS mascota,
              CONCAT(uc.nombre, ' ', uc.apellido) AS cliente, et.nombre AS estado
       FROM turnos t
       JOIN mascotas m ON m.id = t.mascota_id
       JOIN clientes c ON c.id = m.cliente_id
       JOIN usuarios uc ON uc.id = c.usuario_id
       JOIN veterinarios v ON v.id = t.veterinario_id
       JOIN estados_turno et ON et.id = t.estado_id
       WHERE v.usuario_id = ? AND t.fecha = ?
       ORDER BY t.hora`,
      [req.user.id, today],
    );
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

// POST /api/turnos — valida que la mascota esté activa.
router.post(
  '/turnos',
  authMiddleware,
  allowRoles(USER_TYPES.CLIENT),
  [
    body('mascota_id').isInt().withMessage('Seleccioná una mascota válida.'),
    body('veterinario_id').isInt().withMessage('Seleccioná un profesional.'),
    body('fecha').notEmpty().withMessage('La fecha es obligatoria.'),
    body('hora').notEmpty().withMessage('La hora es obligatoria.'),
    body('motivo').trim().notEmpty().withMessage('El motivo es obligatorio.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const clientId = await getClientId(req.user.id);
      const { mascota_id, veterinario_id, fecha, hora, motivo } = req.body;

      // Solo permite mascotas activas que pertenezcan al cliente
      const [pets] = await pool.query(
        'SELECT id FROM mascotas WHERE id = ? AND cliente_id = ? AND COALESCE(activo, 1) = 1',
        [mascota_id, clientId],
      );
      if (!pets[0]) return res.status(403).json({ message: 'Mascota no válida o no te pertenece.' });

      const [vets] = await pool.query('SELECT id FROM veterinarios WHERE id = ?', [veterinario_id]);
      if (!vets[0]) return res.status(404).json({ message: 'Veterinario no encontrado.' });

      const [result] = await pool.query(
        'INSERT INTO turnos(mascota_id, veterinario_id, fecha, hora, motivo) VALUES (?, ?, ?, ?, ?)',
        [mascota_id, veterinario_id, fecha, hora, motivo],
      );
      return res.status(201).json({ id: result.insertId, message: 'Turno solicitado correctamente.' });
    } catch (error) {
      return next(error);
    }
  },
);

// PATCH /api/turnos/:id/cancelar — cancelación de turno por parte del cliente o admin.
router.patch(
  '/turnos/:id/cancelar',
  authMiddleware,
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      let checkSql = `SELECT t.id, et.nombre AS estado FROM turnos t
                      JOIN estados_turno et ON et.id = t.estado_id
                      JOIN mascotas m ON m.id = t.mascota_id
                      JOIN clientes c ON c.id = m.cliente_id
                      WHERE t.id = ?`;
      let checkParams = [req.params.id];
      if (hasUserType(req.user, USER_TYPES.CLIENT)) {
        checkSql += ' AND c.usuario_id = ?';
        checkParams.push(req.user.id);
      } else if (!hasUserType(req.user, USER_TYPES.ADMIN)) {
        return res.status(403).json({ message: 'No tenés permiso para esta acción.' });
      }

      const [rows] = await pool.query(checkSql, checkParams);
      const turno = rows[0];
      if (!turno) return res.status(404).json({ message: 'Turno no encontrado.' });
      if (turno.estado !== 'Pendiente' && turno.estado !== 'Confirmado') {
        return res.status(409).json({ message: 'Solo se pueden cancelar turnos pendientes o confirmados.' });
      }

      const [[estadoRow]] = await pool.query('SELECT id FROM estados_turno WHERE nombre = "Cancelado"');
      await pool.query('UPDATE turnos SET estado_id = ? WHERE id = ?', [estadoRow.id, req.params.id]);
      return res.json({ message: 'Turno cancelado correctamente.' });
    } catch (error) {
      return next(error);
    }
  },
);

// PATCH /api/turnos/:id/estado — acciones del veterinario sobre turnos.
router.patch(
  '/turnos/:id/estado',
  authMiddleware,
  allowRoles(USER_TYPES.VET),
  [param('id').isInt(), body('accion').isIn(['confirmar', 'completar', 'cancelar'])],
  validate,
  async (req, res, next) => {
    try {
      const vetId = await getVetId(req.user.id);
      const [rows] = await pool.query(
        `SELECT t.id, et.nombre AS estado
         FROM turnos t
         JOIN estados_turno et ON et.id = t.estado_id
         WHERE t.id = ? AND t.veterinario_id = ?`,
        [req.params.id, vetId],
      );
      const turno = rows[0];
      if (!turno) return res.status(404).json({ message: 'Turno no encontrado.' });

      const transitions = {
        confirmar: { from: ['Pendiente'], to: 'Confirmado' },
        completar: { from: ['Confirmado', 'Pendiente'], to: 'Completado' },
        cancelar: { from: ['Pendiente', 'Confirmado'], to: 'Cancelado' },
      };
      const rule = transitions[req.body.accion];
      if (!rule.from.includes(turno.estado)) {
        return res.status(409).json({ message: 'Esta acción no está disponible para el estado actual.' });
      }

      const [[estadoRow]] = await pool.query('SELECT id FROM estados_turno WHERE nombre = ?', [rule.to]);
      await pool.query('UPDATE turnos SET estado_id = ? WHERE id = ?', [estadoRow.id, req.params.id]);
      return res.json({ message: `Turno ${rule.to.toLowerCase()} correctamente.` });
    } catch (error) {
      return next(error);
    }
  },
);

// GET /api/consultas — consultas recientes según rol.
router.get('/consultas', authMiddleware, async (req, res, next) => {
  try {
    let sql = `SELECT c.id, c.fecha AS fecha_consulta, c.diagnostico, c.tratamiento,
                      m.nombre AS mascota, t.fecha, t.hora,
                      CONCAT(uv.nombre, ' ', uv.apellido) AS veterinario
               FROM consultas c
               JOIN turnos t ON t.id = c.turno_id
               JOIN mascotas m ON m.id = t.mascota_id
               JOIN veterinarios v ON v.id = t.veterinario_id
               JOIN usuarios uv ON uv.id = v.usuario_id
               JOIN clientes cl ON cl.id = m.cliente_id`;
    let params = [];

    if (hasUserType(req.user, USER_TYPES.CLIENT)) {
      sql += ' WHERE cl.usuario_id = ?';
      params = [req.user.id];
    } else if (hasUserType(req.user, USER_TYPES.VET)) {
      sql += ' WHERE v.usuario_id = ?';
      params = [req.user.id];
    }

    sql += ' ORDER BY c.fecha DESC LIMIT 20';

    try {
      const [rows] = await pool.query(sql, params);
      return res.json(rows);
    } catch {
      // Si la tabla consultas no existe, devolvemos turnos completados como fallback.
      let fallback = `SELECT t.id, t.fecha, t.hora, m.nombre AS mascota, et.nombre AS estado,
                             CONCAT(uv.nombre, ' ', uv.apellido) AS veterinario
                      FROM turnos t
                      JOIN mascotas m ON m.id = t.mascota_id
                      JOIN estados_turno et ON et.id = t.estado_id
                      JOIN veterinarios v ON v.id = t.veterinario_id
                      JOIN usuarios uv ON uv.id = v.usuario_id
                      JOIN clientes cl ON cl.id = m.cliente_id
                      WHERE et.nombre = 'Completado'`;
      const fbParams = [];
      if (hasUserType(req.user, USER_TYPES.CLIENT)) {
        fallback += ' AND cl.usuario_id = ?';
        fbParams.push(req.user.id);
      } else if (hasUserType(req.user, USER_TYPES.VET)) {
        fallback += ' AND v.usuario_id = ?';
        fbParams.push(req.user.id);
      }
      fallback += ' ORDER BY t.fecha DESC LIMIT 20';
      const [rows] = await pool.query(fallback, fbParams);
      return res.json(rows);
    }
  } catch (error) {
    return next(error);
  }
});

// GET /api/dashboard — resumen según rol autenticado.
router.get('/dashboard', authMiddleware, async (req, res, next) => {
  try {
    if (hasUserType(req.user, USER_TYPES.ADMIN)) {
      return res.status(403).json({ message: 'Usá /api/admin/resumen para el panel administrativo.' });
    }

    if (hasUserType(req.user, USER_TYPES.CLIENT)) {
      const clientId = await getClientId(req.user.id);
      // Cuenta solo mascotas activas
      const [[pets]] = await pool.query('SELECT COUNT(*) AS total FROM mascotas WHERE cliente_id = ? AND COALESCE(activo, 1) = 1', [clientId]);
      const [[upcoming]] = await pool.query(
        `SELECT COUNT(*) AS total FROM turnos t
         JOIN mascotas m ON m.id = t.mascota_id
         JOIN estados_turno e ON e.id = t.estado_id
         WHERE m.cliente_id = ? AND e.nombre IN ('Pendiente', 'Confirmado')`,
        [clientId],
      );
      let consultas = 0;
      try {
        const [[c]] = await pool.query(
          `SELECT COUNT(*) AS total FROM consultas c
           JOIN turnos t ON t.id = c.turno_id
           JOIN mascotas m ON m.id = t.mascota_id
           WHERE m.cliente_id = ?`,
          [clientId],
        );
        consultas = c.total;
      } catch {
        const [[c]] = await pool.query(
          `SELECT COUNT(*) AS total FROM turnos t
           JOIN mascotas m ON m.id = t.mascota_id
           JOIN estados_turno e ON e.id = t.estado_id
           WHERE m.cliente_id = ? AND e.nombre = 'Completado'`,
          [clientId],
        );
        consultas = c.total;
      }
      return res.json({ mascotas: pets.total, turnosPendientes: upcoming.total, consultas });
    }

    if (hasUserType(req.user, USER_TYPES.VET)) {
      const vetId = await getVetId(req.user.id);
      const [[patients]] = await pool.query(
        'SELECT COUNT(DISTINCT mascota_id) AS total FROM turnos WHERE veterinario_id = ?',
        [vetId],
      );
      const [[pending]] = await pool.query(
        `SELECT COUNT(*) AS total FROM turnos t
         JOIN estados_turno e ON e.id = t.estado_id
         WHERE t.veterinario_id = ? AND e.nombre IN ('Pendiente', 'Confirmado')`,
        [vetId],
      );
      let consultas = 0;
      try {
        const [[c]] = await pool.query(
          `SELECT COUNT(*) AS total FROM consultas c
           JOIN turnos t ON t.id = c.turno_id
           WHERE t.veterinario_id = ?`,
          [vetId],
        );
        consultas = c.total;
      } catch {
        const [[c]] = await pool.query(
          `SELECT COUNT(*) AS total FROM turnos t
           JOIN estados_turno e ON e.id = t.estado_id
           WHERE t.veterinario_id = ? AND e.nombre = 'Completado'`,
          [vetId],
        );
        consultas = c.total;
      }
      return res.json({ pacientes: patients.total, turnosPendientes: pending.total, consultas });
    }

    return res.status(403).json({ message: 'Rol no autorizado.' });
  } catch (error) {
    return next(error);
  }
});

export default router;
