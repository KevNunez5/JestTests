import { Router, Request, Response } from "express";
import { supabase } from "../supabaseClient";
import dotenv from "dotenv";
import multer from 'multer';
import archiver from 'archiver';
import { PassThrough, Readable } from 'stream';
import axios from 'axios';
import stream from 'stream';


async function readableStreamToBuffer(readableStream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = readableStream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
  }

  return Buffer.concat(chunks);
}

const upload = multer({ storage: multer.memoryStorage() }); 
const router = Router();

dotenv.config();
/**
 * @swagger
 * /pdfLogic/upload-pdf/{bucketName}:
 *   post:
 *     summary: Subir un archivo PDF a un bucket de almacenamiento
 *     description: Permite subir un archivo PDF a un bucket específico en Supabase Storage
 *     tags: [Storage]
 *     parameters:
 *       - in: path
 *         name: bucketName
 *         required: true
 *         schema:
 *           type: string
 *         description: Nombre del bucket donde se almacenará el archivo
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *                 description: Archivo PDF a subir
 *     responses:
 *       200:
 *         description: Archivo subido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 url:
 *                   type: string
 *                   description: URL pública del archivo subido
 *                 bucket:
 *                   type: string
 *                   description: Nombre del bucket donde se almacenó
 *       400:
 *         description: Solicitud inválida (falta archivo o bucket no existe)
 *       500:
 *         description: Error al subir el archivo
 */

router.post('/upload-pdf/:bucketName', upload.single('pdf'), async (req, res):Promise<any> => {
    try {
      const file = req.file;
      const bucketName = req.params.bucketName; 
  
      if (!file) {
        return res.status(400).json({ error: 'No se subió ningún archivo' });
      }
  
      const { data: buckets } = await supabase.storage.listBuckets();
      if (!buckets?.some(b => b.name === bucketName)) {
        return res.status(400).json({ error: `El bucket ${bucketName} no existe` });
      }
  
      const fileName = `${Date.now()}_${file.originalname}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
        });
  
      if (uploadError) throw uploadError;
  
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(uploadData.path);
  
      res.json({ 
        success: true,
        url: publicUrl,
        bucket: bucketName 
      });
  
    } catch (error) {
      console.error('Error al subir el PDF:', error);
      res.status(500).json({ 
        error: 'Error al subir el archivo',
        details: error 
      });
    }
  });

/**
 * @swagger
 * /pdfLogic/download-bucket-zip/{bucketName}:
 *   get:
 *     summary: Descargar todo el contenido de un bucket como ZIP
 *     description: Genera y descarga un archivo ZIP con todos los archivos contenidos en un bucket específico
 *     tags: [Storage]
 *     parameters:
 *       - in: path
 *         name: bucketName
 *         required: true
 *         schema:
 *           type: string
 *         description: Nombre del bucket a descargar
 *     responses:
 *       200:
 *         description: Archivo ZIP generado exitosamente
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Nombre de bucket no proporcionado
 *       500:
 *         description: Error al generar el archivo ZIP
 */
  router.get('/download-bucket-zip/:bucketName', async (req: Request, res: Response):Promise<any> => {
    const { bucketName } = req.params;
    console.log(`Iniciando descarga del bucket: ${bucketName}`);

    // Validar que el bucketName no esté vacío
    if (!bucketName || bucketName.trim() === '') {
        return res.status(400).json({ error: 'Nombre del bucket no proporcionado' });
    }

    const archive = archiver('zip', { 
        zlib: { level: 9 } // Nivel máximo de compresión
    });

    // Manejar errores del archiver
    archive.on('error', (err) => {
        console.error('Error en archiver:', err);
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Error al generar el archivo ZIP',
                details: err.message 
            });
        }
    });

    // Configurar headers de respuesta
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${bucketName}.zip`);
    
    // Pipe el archivo ZIP a la respuesta
    archive.pipe(res);

    try {
        // 1. Listar todos los archivos en el bucket
        const { data: files, error: listError } = await supabase.storage
            .from(bucketName)
            .list('', {
                limit: 1000,
                sortBy: { column: 'name', order: 'asc' }
            });

        if (listError) {
            throw new Error(`Error al listar archivos: ${listError.message}`);
        }

        // Filtrar solo archivos válidos (excluir directorios)
        const validFiles = files.filter(file => 
            file.name && 
            typeof file.name === 'string' &&
            !file.name.endsWith('/')
        );

        if (validFiles.length === 0) {
            archive.append('No se encontraron archivos válidos en el bucket', { name: 'AVISO.txt' });
            return archive.finalize();
        }

        console.log(`Archivos a descargar: ${validFiles.length}`);

        // 2. Descargar y agregar cada archivo al ZIP
        for (const file of validFiles) {
            try {
                console.log(`Descargando: ${file.name}`);
                
                const { data: blob, error: downloadError } = await supabase.storage
                    .from(bucketName)
                    .download(file.name);

                if (downloadError) {
                    console.error(`Error al descargar ${file.name}:`, downloadError);
                    archive.append(`Error al descargar: ${file.name}`, { name: `ERROR_${file.name}.txt` });
                    continue;
                }

                // Convertir el blob a Buffer y agregar al ZIP
                const buffer = Buffer.from(await blob.arrayBuffer());
                archive.append(buffer, { name: file.name });
                console.log(`Archivo agregado al ZIP: ${file.name} (${buffer.length} bytes)`);

            } catch (err) {
                console.error(`Error procesando ${file.name}:`, err);
                archive.append(`Error procesando: ${file.name}`, { name: `ERROR_${file.name}.txt` });
            }
        }

        // Finalizar el archivo ZIP
        await archive.finalize();
        console.log('Archivo ZIP generado exitosamente');

    } catch (error) {
        console.error('Error general:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Error al generar el archivo ZIP',
                details: error 
            });
        }
        archive.abort();
    }
});

/**
 * @swagger
 * /pdfLogic/download-urls-zip:
 *   post:
 *     summary: Descargar múltiples archivos desde URLs y comprimirlos en ZIP
 *     description: Descarga archivos desde una lista de URLs y los comprime en un único archivo ZIP
 *     tags: [Storage]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               urls:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *                 description: Lista de URLs de archivos a descargar
 *             required:
 *               - urls
 *     responses:
 *       200:
 *         description: Archivo ZIP generado exitosamente
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Lista de URLs inválida o vacía
 *       500:
 *         description: Error al generar el archivo ZIP
 */


router.post('/download-urls-zip', async (req: Request, res: Response):Promise<any> => {
  const { urls } = req.body;
  
  // Validar entrada
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de URLs válido' });
  }

  // Configurar el archivo ZIP
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  // Configurar headers de respuesta
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename=descargas.zip');
  archive.pipe(res);

  // Manejar errores del archiver
  archive.on('error', (err) => {
      console.error('Error en archiver:', err);
      if (!res.headersSent) {
          res.status(500).json({ error: 'Error al generar el ZIP' });
      }
  });

  try {
      // Procesar cada URL
      for (const url of urls) {
          try {
              if (!url || typeof url !== 'string') {
                  console.warn(`URL inválida: ${url}`);
                  archive.append(`URL inválida: ${url}`, { name: `ERROR_URL_INVALIDA.txt` });
                  continue;
              }

              // Extraer nombre del archivo de la URL
              const fileName = url.split('/').pop() || `archivo_${Date.now()}`;
              console.log(`Descargando: ${fileName} desde ${url}`);

              // Descargar el archivo
              const response = await axios({
                  method: 'get',
                  url: url,
                  responseType: 'stream'
              });

              // Verificar respuesta exitosa
              if (response.status !== 200) {
                  throw new Error(`HTTP ${response.status}`);
              }

              // Crear un stream de transformación para manejar los datos
              const fileStream = new stream.PassThrough();
              response.data.pipe(fileStream);

              // Agregar al ZIP
              archive.append(fileStream, { name: fileName });
              console.log(`Archivo agregado: ${fileName}`);

          } catch (error) {
              console.error(`Error al procesar ${url}:`, error);
              archive.append(`Error al descargar: ${url}\n${error}`, 
                  { name: `ERROR_${url.replace(/[^a-z0-9]/gi, '_')}.txt` });
          }
      }

      // Finalizar el archivo ZIP
      await archive.finalize();
      console.log('ZIP generado exitosamente');

  } catch (error) {
      console.error('Error general:', error);
      if (!res.headersSent) {
          res.status(500).json({ 
              error: 'Error al generar el archivo ZIP',
              details: error 
          });
      }
      archive.abort();
  }
});

/**
 * @swagger
 * /pdfLogic/download-permisos-zip:
 *   post:
 *     summary: Descargar permisos de padres organizados por sede
 *     description: Genera un ZIP con carpetas por sede conteniendo los permisos de los participantes
 *     tags: [Storage]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sedes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: number
 *                       description: ID de la sede
 *                     nombre:
 *                       type: string
 *                       description: Nombre de la sede
 *             required:
 *               - sedes
 *     responses:
 *       200:
 *         description: Archivo ZIP generado exitosamente
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Lista de sedes inválida
 *       500:
 *         description: Error al generar el archivo ZIP
 */
router.post('/download-permisos-zip', async (req: Request, res: Response): Promise<any> => {
    const { sedes } = req.body; // Espera { sedes: [{ id: number, nombre: string }] }

    if (!sedes || !Array.isArray(sedes)) {
        return res.status(400).json({ error: 'Se requiere un array de sedes válido' });
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=permisos_sedes.zip');
    archive.pipe(res);

    try {
        // Obtener participantes por sede
        for (const sede of sedes) {
            const { data: participantes, error } = await supabase
                .from('participante')
                .select('nombre, permiso_papas')
                .eq('id_sede', sede.id);

            if (error) {
                archive.append(`Error en sede ${sede.nombre}: ${error.message}`, 
                    { name: `${sede.nombre}/ERROR.txt` });
                continue;
            }

            // Procesar cada participante
            for (const participante of participantes) {
                if (!participante.permiso_papas || participante.permiso_papas === 'si') continue;

                try {
                    const response = await axios.get(participante.permiso_papas, {
                        responseType: 'stream'
                    });

                    const fileName = `${participante.nombre}_${participante.permiso_papas.split('/').pop()}`;
                    const fileStream = new PassThrough();
                    response.data.pipe(fileStream);

                    archive.append(fileStream, { 
                        name: `${sede.nombre}/${fileName}` 
                    });
                } catch (error) {
                    archive.append(`Error en ${participante.nombre}: ${error}`, 
                        { name: `${sede.nombre}/ERROR_${participante.nombre}.txt` });
                }
            }
        }

        await archive.finalize();
    } catch (error) {
        console.error('Error general:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error al generar ZIP' });
        }
        archive.abort();
    }
});



/**
 * @swagger
 * /pdfLogic/download-permisos-by-ids:
 *   post:
 *     summary: Descargar permisos de padres por IDs de participantes
 *     description: Genera un ZIP con los permisos de los participantes especificados por sus IDs
 *     tags: [Storage]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids_participantes:
 *                 type: array
 *                 items:
 *                   type: number
 *                 description: IDs de los participantes cuyos permisos se descargarán
 *             required:
 *               - ids_participantes
 *     responses:
 *       200:
 *         description: Archivo ZIP generado exitosamente
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Lista de IDs inválida o vacía
 *       500:
 *         description: Error al generar el archivo ZIP
 */
router.post('/download-permisos-by-ids', async (req: Request, res: Response): Promise<any> => {
    const { ids_participantes } = req.body;
    
    // Validar entrada
    if (!ids_participantes || !Array.isArray(ids_participantes) || ids_participantes.length === 0) {
        return res.status(400).json({ error: 'Se requiere un array de IDs de participantes válido' });
    }

    // Configurar el archivo ZIP
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // Configurar headers de respuesta
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=permisos_participantes.zip');
    archive.pipe(res);

    // Manejar errores del archiver
    archive.on('error', (err) => {
        console.error('Error en archiver:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error al generar el ZIP' });
        }
    });

    try {
        // Obtener participantes de la base de datos
        const { data: participantes, error } = await supabase
            .from('participante')
            .select('id_participante, nombre, permiso_papas')
            .in('id_participante', ids_participantes);

        if (error) {
            throw new Error(`Error al obtener participantes: ${error.message}`);
        }

        // Procesar cada participante
        for (const participante of participantes) {
            try {
                if (!participante.permiso_papas || participante.permiso_papas === 'si') {
                    archive.append(`No tiene permiso válido: ${participante.nombre}`, 
                        { name: `SIN_PERMISO_${participante.id_participante}.txt` });
                    continue;
                }

                const url = participante.permiso_papas;
                const nombreArchivo = `${participante.nombre || participante.id_participante}_${url.split('/').pop()}`;

                // Descargar el archivo
                const response = await axios({
                    method: 'get',
                    url: url,
                    responseType: 'stream'
                });

                // Verificar respuesta exitosa
                if (response.status !== 200) {
                    throw new Error(`HTTP ${response.status}`);
                }

                // Crear stream de transformación
                const fileStream = new stream.PassThrough();
                response.data.pipe(fileStream);

                // Agregar al ZIP
                archive.append(fileStream, { name: nombreArchivo });
                console.log(`Archivo agregado: ${nombreArchivo}`);

            } catch (error) {
                console.error(`Error al procesar participante ${participante.id_participante}:`, error);
                archive.append(`Error al descargar permiso: ${participante.nombre}\n${error}`, 
                    { name: `ERROR_${participante.id_participante}.txt` });
            }
        }

        // Finalizar el archivo ZIP
        await archive.finalize();
        console.log('ZIP de permisos generado exitosamente');

    } catch (error) {
        console.error('Error general:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Error al generar el archivo ZIP',
                details: error 
            });
        }
        archive.abort();
    }
});

export default router;
