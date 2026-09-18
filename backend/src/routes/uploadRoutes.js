import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadsDirectory } from '../config/uploads.js';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/auth.js';
//este router controla de forma segura la subida de fotos de mascotas, 
// evitando archivos demasiado grandes, formatos 
// no permitidos o archivos que intenten hacerse pasar por imágenes.
const router = Router();


// Directorios de subida seguros
const uploadsBase = uploadsDirectory;
const mascotasUploads = path.join(uploadsBase, 'mascotas');

// Formatos permitidos estrictos
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const createStorage = (targetDir) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => {
      // Se crea al subir, no durante la importación en un entorno serverless.
      fs.mkdir(targetDir, { recursive: true }, error => cb(error, targetDir));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeName = `${crypto.randomUUID()}${ext}`;
      cb(null, safeName);
    },
  });
// Valida el tipo de archivo y la extensión antes de guardarlo
const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIMES.has(file.mimetype) || !ALLOWED_EXTS.has(ext)) {
    const error = new Error('Formato no permitido. Solo se aceptan imágenes JPG, JPEG, PNG y WEBP.');
    error.status = 400;
    error.expose = true;
    return cb(error, false);
  }
  return cb(null, true);
};
// Configuración de multer para subir imágenes de mascotas
const uploadMascota = multer({
  storage: createStorage(mascotasUploads),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
}).single('imagen');
// Verifica la firma de los bytes del archivo para asegurarse de que sea una imagen válida
const isImageSignature = (filePath, mimetype) => {
  const bytes = fs.readFileSync(filePath);
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = bytes.length >= 12 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  return (mimetype === 'image/jpeg' && isJpeg) || (mimetype === 'image/png' && isPng) || (mimetype === 'image/webp' && isWebp);
};
const handleUpload = (uploader, subpath) => (req, res, _next) => {
  uploader(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          message: 'La imagen supera el tamaño máximo permitido de 5 MB.',
        });
      }
      return res.status(400).json({
        message: err.message || 'Error al procesar la imagen.',
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No se envió ninguna imagen.' });
    }

    if (req.file.size === 0) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
      return res.status(400).json({ message: 'El archivo de imagen está vacío.' });
    }
    if (!isImageSignature(req.file.path, req.file.mimetype)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
      return res.status(400).json({ message: 'El archivo no contiene una imagen válida.' });
    }
// Genera la URL pública de la imagen subida
    const publicUrl = `/uploads/${subpath}/${req.file.filename}`;
    return res.status(201).json({
      url: publicUrl,
      filename: req.file.filename,
      message: 'Imagen subida correctamente.',
    });
  });
};

// Rutas autenticadas
router.post('/mascota', authMiddleware, handleUpload(uploadMascota, 'mascotas'));

export default router;
