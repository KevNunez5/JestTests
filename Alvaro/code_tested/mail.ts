import { Router, Request, Response } from "express";
import { supabase } from "../supabaseClient";
import dotenv from "dotenv";

const router = Router();

dotenv.config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});


/**
 * @swagger
 * tags:
 *   - name: Correos
 *     description: Endpoints para gestión de envío de correos electrónicos
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Destinatario:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID del destinatario
 *         tabla:
 *           type: string
 *           description: Tabla donde se encuentra el destinatario
 *           enum: [coordinador, facilitadora, participante, mentora, colaboradora]
 *     ResultadoCorreo:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         tabla:
 *           type: string
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         error:
 *           type: string
 *         destinatario:
 *           type: string
 */

/**
 * @swagger
 * /mail/enviar-correo-coordinadora-rechazado:
 *   post:
 *     summary: Enviar correo a coordinadoras rechazadas
 *     description: Envía correos a coordinadoras cuyo registro ha sido rechazado
 *     tags: [Correos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               destinatarios:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Destinatario'
 *               asunto:
 *                 type: string
 *               contenido:
 *                 type: string
 *             example:
 *               destinatarios:
 *                 - {id: 1, tabla: "coordinador"}
 *               asunto: "Registro rechazado"
 *               contenido: "Lamentamos informarle que su registro ha sido rechazado"
 *     responses:
 *       200:
 *         description: Resultado del envío
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 resultados:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ResultadoCorreo'
 *       400:
 *         description: Faltan parámetros requeridos
 *       500:
 *         description: Error en el servidor
 */
router.post('/enviar-correo-coordinadora-rechazado', async (req, res): Promise<any> => {
  try {
    const { destinatarios, asunto, contenido } = req.body;
    
    if (!destinatarios || !Array.isArray(destinatarios)) {
      return res.status(400).json({ error: 'Se requiere una lista de destinatarios' });
    }

    if (!asunto || !contenido) {
      return res.status(400).json({ error: 'Faltan asunto o contenido' });
    }
    const resultados: any[] = [];

    for (const dest of destinatarios) {
      try {
        const { id, tabla } = dest;

        console.log("id: ", id)
        console.log("tabla: ", tabla)
        
        const { data, error } = await supabase
          .from(tabla)
          .select('correo, nombre, username, password')
          .eq('id_'+tabla, id)
          .maybeSingle();
        
        console.log("data: ", data)

        if (error || !data) {
          resultados.push({
            id,
            tabla,
            success: false,
            error: 'No se encontró el destinatario en la base de datos'
          });
          continue;
        }

        const { correo, nombre, username, password } = data;

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: correo,
          subject: asunto,
          html: `
            <h1>Hola ${nombre},</h1>
            <p>${contenido}</p>
          `,
        };

        await transporter.sendMail(mailOptions);

        resultados.push({
          id,
          tabla,
          success: true,
          message: 'Correo enviado exitosamente',
          destinatario: correo
        });

      } catch (error) {
        console.error(`Error procesando destinatario ${dest.id} de ${dest.tabla}:`, error);
        resultados.push({
          id: dest.id,
          tabla: dest.tabla,
          success: false,
          error: 'Error al procesar este destinatario'
        });
      }
    }

    res.json({
      success: true,
      message: 'Proceso de envío completado',
      resultados
    });

  } catch (error) {
    console.error('Error general al enviar correos:', error);
    res.status(500).json({ error: 'Error general al enviar los correos' });
  }
});


/**
 * @swagger
 * /mail/enviar-correo-coordinadora-aceptado:
 *   post:
 *     summary: Enviar correo a coordinadoras aceptadas
 *     description: Envía correos a coordinadoras cuyo registro ha sido aceptado (incluye credenciales)
 *     tags: [Correos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               destinatarios:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Destinatario'
 *               asunto:
 *                 type: string
 *               contenido:
 *                 type: string
 *             example:
 *               destinatarios:
 *                 - {id: 1, tabla: "coordinador"}
 *               asunto: "Registro aceptado"
 *               contenido: "¡Felicidades! Su registro ha sido aceptado"
 *     responses:
 *       200:
 *         description: Resultado del envío
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 resultados:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ResultadoCorreo'
 *       400:
 *         description: Faltan parámetros requeridos
 *       500:
 *         description: Error en el servidor
 */
router.post('/enviar-correo-coordinadora-aceptado', async (req, res): Promise<any> => {
  try {
    const { destinatarios, asunto, contenido } = req.body;
    
    if (!destinatarios || !Array.isArray(destinatarios)) {
      return res.status(400).json({ error: 'Se requiere una lista de destinatarios' });
    }

    if (!asunto || !contenido) {
      return res.status(400).json({ error: 'Faltan asunto o contenido' });
    }

    const resultados: any[] = [];

    for (const dest of destinatarios) {
      try {
        const { id, tabla } = dest;

        console.log("id: ", id)
        console.log("tabla: ", tabla)
        
        const { data, error } = await supabase
          .from(tabla)
          .select('correo, nombre, username, password')
          .eq('id_'+tabla, id)
          .maybeSingle();
        
        console.log("data: ", data)

        if (error || !data) {
          resultados.push({
            id,
            tabla,
            success: false,
            error: 'No se encontró el destinatario en la base de datos'
          });
          continue;
        }

        const { data: decryptedPassword, error: decryptError } = await supabase.rpc(
          "decrypt_password",
          { 
              encrypted_text: data.password, 
              passphrase: process.env.PGP_PASSPHRASE_2
          }
      );   

        const { correo, nombre, username, password } = data;

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: correo,
          subject: asunto,
          html: `
            <h1>Hola ${nombre},</h1>
            <p>${contenido}</p>
            <p>Se te adjuntan tus credenciales para iniciar sesion</p>
            <p>username: ${username}</p>
            <p>password: ${decryptedPassword}</p>
          `,
        };

        await transporter.sendMail(mailOptions);

        resultados.push({
          id,
          tabla,
          success: true,
          message: 'Correo enviado exitosamente',
          destinatario: correo
        });

      } catch (error) {
        console.error(`Error procesando destinatario ${dest.id} de ${dest.tabla}:`, error);
        resultados.push({
          id: dest.id,
          tabla: dest.tabla,
          success: false,
          error: 'Error al procesar este destinatario'
        });
      }
    }

    res.json({
      success: true,
      message: 'Proceso de envío completado',
      resultados
    });

  } catch (error) {
    console.error('Error general al enviar correos:', error);
    res.status(500).json({ error: 'Error general al enviar los correos' });
  }
});




/**
 * @swagger
 * /mail/enviar-correo-multiple:
 *   post:
 *     summary: Enviar correo a múltiples destinatarios
 *     description: Envía correos a múltiples destinatarios de diferentes tablas
 *     tags: [Correos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               destinatarios:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Destinatario'
 *               asunto:
 *                 type: string
 *               contenido:
 *                 type: string
 *             example:
 *               destinatarios:
 *                 - {id: 1, tabla: "facilitadora"}
 *                 - {id: 3, tabla: "participante"}
 *               asunto: "Mensaje importante"
 *               contenido: "Este es el contenido del mensaje"
 *     responses:
 *       200:
 *         description: Resultado del envío
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 resultados:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ResultadoCorreo'
 *       400:
 *         description: Faltan parámetros requeridos
 *       500:
 *         description: Error en el servidor
 */
router.post('/enviar-correo-multiple', async (req, res): Promise<any> => {
  try {
    const { destinatarios, asunto, contenido } = req.body;
    
    if (!destinatarios || !Array.isArray(destinatarios)) {
      return res.status(400).json({ error: 'Se requiere una lista de destinatarios' });
    }

    if (!asunto || !contenido) {
      return res.status(400).json({ error: 'Faltan asunto o contenido' });
    }

    // Array para guardar los resultados de cada envío
    const resultados: any[] = [];

    // Procesar cada destinatario
    for (const dest of destinatarios) {
      try {
        const { id, tabla } = dest;

        console.log("id: ", id)
        console.log("tabla: ", tabla)
        
        // Obtener datos del destinatario desde Supabase
        const { data, error } = await supabase
          .from(tabla)
          .select('correo, nombre')
          .eq('id_'+tabla, id)
          .maybeSingle();
        
        console.log("data: ", data)

        if (error || !data) {
          resultados.push({
            id,
            tabla,
            success: false,
            error: 'No se encontró el destinatario en la base de datos'
          });
          continue;
        }

        const { correo, nombre } = data;

        // Configurar y enviar el correo
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: correo,
          subject: asunto,
          html: `
            <h1>Hola ${nombre},</h1>
            <p>${contenido}</p>
          `,
        };

        await transporter.sendMail(mailOptions);

        resultados.push({
          id,
          tabla,
          success: true,
          message: 'Correo enviado exitosamente',
          destinatario: correo
        });

      } catch (error) {
        console.error(`Error procesando destinatario ${dest.id} de ${dest.tabla}:`, error);
        resultados.push({
          id: dest.id,
          tabla: dest.tabla,
          success: false,
          error: 'Error al procesar este destinatario'
        });
      }
    }

    res.json({
      success: true,
      message: 'Proceso de envío completado',
      resultados
    });

  } catch (error) {
    console.error('Error general al enviar correos:', error);
    res.status(500).json({ error: 'Error general al enviar los correos' });
  }
});


/**
 * @swagger
 * /mail/enviar-correo-multiple/tablas/superusuario:
 *   post:
 *     summary: Enviar correo a todos los registros de tablas específicas (para superusuario)
 *     description: Envía correos a todos los registros de las tablas especificadas
 *     tags: [Correos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               destinatarios:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     tabla:
 *                       type: string
 *                       enum: [facilitadora, participante, instructora, staff]
 *               asunto:
 *                 type: string
 *               contenido:
 *                 type: string
 *             example:
 *               destinatarios:
 *                 - {tabla: "facilitadora"}
 *                 - {tabla: "participante"}
 *               asunto: "Mensaje importante"
 *               contenido: "Este es el contenido del mensaje"
 *     responses:
 *       200:
 *         description: Resultado del envío
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 total_enviados:
 *                   type: integer
 *                 resultados:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ResultadoCorreo'
 *       400:
 *         description: Faltan parámetros requeridos
 *       500:
 *         description: Error en el servidor
 */
router.post('/enviar-correo-multiple/tablas/superusuario', async (req, res): Promise<any> => {
  try {
    const { destinatarios, asunto, contenido } = req.body;

    if (!destinatarios || !Array.isArray(destinatarios)) {
      return res.status(400).json({ error: 'Se requiere una lista de tablas' });
    }

    if (!asunto || !contenido) {
      return res.status(400).json({ error: 'Faltan asunto o contenido' });
    }

    const resultados: any[] = [];

    for (const dest of destinatarios) {
      try {
        let { tabla } = dest;
        let data, error;

        // Verificar si la tabla es una de las especiales
        const rolesEspeciales = ['instructora', 'staff', 'facilitadora'];

        if (rolesEspeciales.includes(tabla)) {
          // Consultar la tabla "colaboradora" con filtro en rol_asignado
          ({ data, error } = await supabase
            .from('colaboradora')
            .select('correo, nombre')
            .in('rol_asignado', [tabla]));
          tabla = 'colaboradora'; // Actualizamos el nombre de tabla para el resultado
        } else {
          // Consulta normal
          ({ data, error } = await supabase
            .from(tabla)
            .select('correo, nombre'));
        }

        if (error || !data || data.length === 0) {
          resultados.push({
            tabla,
            success: false,
            error: 'No se encontraron registros en esta tabla'
          });
          continue;
        }

        for (const destinatario of data) {
          try {
            const mailOptions = {
              from: process.env.EMAIL_USER,
              to: destinatario.correo,
              subject: asunto,
              html: `
                <h1>Hola ${destinatario.nombre}, este correo </h1>
                <p>${contenido}</p>
                <p>Tu CORREO es ${destinatario.correo}</p>
              `,
            };

            await transporter.sendMail(mailOptions);

            resultados.push({
              tabla,
              success: true,
              message: 'Correo enviado exitosamente',
              destinatario: destinatario.correo
            });

          } catch (error) {
            console.error(`Error enviando a ${destinatario.correo}:`, error);
            resultados.push({
              tabla,
              destinatario: destinatario.correo,
              success: false,
              error: 'Error al enviar este correo'
            });
          }
        }

      } catch (error) {
        console.error(`Error procesando tabla ${dest.tabla}:`, error);
        resultados.push({
          tabla: dest.tabla,
          success: false,
          error: 'Error al procesar esta tabla'
        });
      }
    }

    res.json({
      success: true,
      message: 'Proceso de envío completado',
      total_enviados: resultados.filter(r => r.success).length,
      resultados
    });

  } catch (error) {
    console.error('Error general:', error);
    res.status(500).json({ error: 'Error general al procesar la solicitud' });
  }
});





/**
 * @swagger
 * /mail/enviar-correo-multiple/tablas/coordinadora:
 *   post:
 *     summary: Enviar correo a registros de tablas específicas por sede (para coordinadora)
 *     description: Envía correos a registros de tablas específicas filtrados por sede
 *     tags: [Correos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               destinatarios:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     tabla:
 *                       type: string
 *                       enum: [facilitadora, participante, instructora, staff]
 *               asunto:
 *                 type: string
 *               contenido:
 *                 type: string
 *               idsede:
 *                 type: integer
 *             example:
 *               destinatarios:
 *                 - {tabla: "facilitadora"}
 *                 - {tabla: "participante"}
 *               asunto: "Mensaje importante"
 *               contenido: "Este es el contenido del mensaje"
 *               idsede: 1
 *     responses:
 *       200:
 *         description: Resultado del envío
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 total_enviados:
 *                   type: integer
 *                 resultados:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ResultadoCorreo'
 *       400:
 *         description: Faltan parámetros requeridos
 *       500:
 *         description: Error en el servidor
 */
router.post('/enviar-correo-multiple/tablas/coordinadora', async (req, res): Promise<any> => {
  try {
    const { destinatarios, asunto, contenido, idsede } = req.body;
    
    if (!destinatarios || !Array.isArray(destinatarios)) {
      return res.status(400).json({ error: 'Se requiere una lista de tablas' });
    }

    if (!asunto || !contenido) {
      return res.status(400).json({ error: 'Faltan asunto o contenido' });
    }

    const resultados: any[] = [];

    for (const dest of destinatarios) {
      try {
        let { tabla } = dest;
        let data, error;

        // Verificar si la tabla es una de las especiales
        const rolesEspeciales = ['instructora', 'staff', 'facilitadora'];

        if (rolesEspeciales.includes(tabla)) {
          // Consultar la tabla "colaboradora" con filtro en rol_asignado
          ({ data, error } = await supabase
            .from('colaboradora')
            .select('correo, nombre')
            .eq('id_sede', idsede)
            .in('rol_asignado', [tabla]));
;
          tabla = 'colaboradora'; // Actualizamos el nombre de tabla para el resultado
        } else {
          // Consulta normal
          ({ data, error } = await supabase
            .from(tabla)
            .select('correo, nombre'));
        }

        if (error || !data || data.length === 0) {
          resultados.push({
            tabla,
            success: false,
            error: 'No se encontraron registros en esta tabla'
          });
          continue;
        }

        // Enviar correo a cada registro encontrado
        for (const destinatario of data) {
          try {
            const mailOptions = {
              from: process.env.EMAIL_USER,
              to: destinatario.correo,
              subject: asunto,
              html: `
                <h1>Hola ${destinatario.nombre}, este correo </h1>
                <p>${contenido}</p>
                <p>Tu CORREO es ${destinatario.correo}</p>
              `,
            };

            await transporter.sendMail(mailOptions);

            resultados.push({
              tabla,
              success: true,
              message: 'Correo enviado exitosamente',
              destinatario: destinatario.correo
            });

          } catch (error) {
            console.error(`Error enviando a ${destinatario.correo}:`, error);
            resultados.push({
              tabla,
              destinatario: destinatario.correo,
              success: false,
              error: 'Error al enviar este correo'
            });
          }
        }

      } catch (error) {
        console.error(`Error procesando tabla ${dest.tabla}:`, error);
        resultados.push({
          tabla: dest.tabla,
          success: false,
          error: 'Error al procesar esta tabla'
        });
      }
    }

    res.json({
      success: true,
      message: 'Proceso de envío completado',
      total_enviados: resultados.filter(r => r.success).length,
      resultados
    });

  } catch (error) {
    console.error('Error general:', error);
    res.status(500).json({ error: 'Error general al procesar la solicitud' });
  }
});

/**
 * @swagger
 * /mail/enviar-correo-simple:
 *   post:
 *     summary: Enviar correo simple a un destinatario
 *     description: Envía un correo electrónico a una dirección específica
 *     tags: [Correos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               correo:
 *                 type: string
 *                 format: email
 *               asunto:
 *                 type: string
 *               contenido:
 *                 type: string
 *               nombre:
 *                 type: string
 *             example:
 *               correo: "ejemplo@dominio.com"
 *               asunto: "Asunto del correo"
 *               contenido: "Contenido del mensaje"
 *               nombre: "Nombre del destinatario"
 *     responses:
 *       200:
 *         description: Correo enviado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 destinatario:
 *                   type: string
 *                 asunto:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Faltan campos requeridos
 *       500:
 *         description: Error al enviar el correo
 */

router.post('/enviar-correo-simple', async (req: Request, res: Response): Promise<any> => {
  try {
    const { correo, asunto, contenido, nombre } = req.body;

    // Validaciones
    if (!correo || !asunto || !contenido) {
      return res.status(400).json({ 
        error: 'Faltan campos requeridos: correo, asunto o contenido' 
      });
    }

    // Configurar el correo
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: correo,
      subject: asunto,
      html: `
        <h1>Hola ${nombre || 'usuario'},</h1>
        <div>${contenido}</div>
      `,
    };

    // Enviar el correo
    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: 'Correo enviado exitosamente',
      destinatario: correo,
      asunto,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error al enviar correo:', error);
    res.status(500).json({ 
      error: 'Error al enviar el correo',
      detalles: error instanceof Error ? error.message : String(error)
    });
  }
});



export default router;
