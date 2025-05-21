import { Router, Request, Response } from "express";
import { supabase } from "../supabaseClient";
import axios from 'axios';


function generarCredenciales(nombre: string): { username: string, password: string } {
    const nombreLimpio = nombre.trim().toLowerCase();
    const username = nombreLimpio.split(" ")[0] + Math.floor(100 + Math.random() * 900); 
    const iniciales = nombreLimpio.split(" ").map(palabra => palabra[0]).join(""); 
    const anio = new Date().getFullYear().toString().slice(-2);
    const randomNum = Math.floor(10 + Math.random() * 90);
    const password = `${iniciales}${anio}${randomNum}`;
    return { username, password };
}


const router = Router();

/**
 * @swagger
 * tags:
 *   - name: sede
 *     description: Endpoints para gestión de sede (campus)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Sede:
 *       type: object
 *       properties:
 *         id_sede:
 *           type: integer
 *           description: ID único de la sede
 *         convocatoria:
 *           type: string
 *           description: URL o identificador de la convocatoria
 *         num_grupos:
 *           type: integer
 *           description: Número de grupos en la sede
 *         fecha:
 *           type: string
 *           description: Fecha de creación de la sede
 *         nombre:
 *           type: string
 *           description: Nombre de la sede
 *         aceptado:
 *           type: boolean
 *           description: Indica si la sede ha sido aceptada
 *         datos_validados:
 *           type: boolean
 *           description: Indica si los datos de la sede han sido validados
 *     SedeInput:
 *       type: object
 *       required:
 *         - convocatoria
 *         - num_grupos
 *         - fecha
 *         - nombre
 *       properties:
 *         convocatoria:
 *           $ref: '#/components/schemas/Sede/properties/convocatoria'
 *         num_grupos:
 *           $ref: '#/components/schemas/Sede/properties/num_grupos'
 *         fecha:
 *           $ref: '#/components/schemas/Sede/properties/fecha'
 *         nombre:
 *           $ref: '#/components/schemas/Sede/properties/nombre'
 *         coordinadornombre:
 *           type: string
 *           description: Nombre del coordinador (opcional)
 *         coordinadorcorreo:
 *           type: string
 *           format: email
 *           description: Correo del coordinador (opcional)
 *         mentoranombre:
 *           type: string
 *           description: Nombre de la mentora (opcional)
 *         mentoracorreo:
 *           type: string
 *           format: email
 *           description: Correo de la mentora (opcional)
 *         informantenombre:
 *           type: string
 *           description: Nombre del informante (opcional)
 *         informantecorreo:
 *           type: string
 *           format: email
 *           description: Correo del informante (opcional)
 *         asociadanombre:
 *           type: string
 *           description: Nombre de la coordinadora asociada (opcional)
 *         asociadacorreo:
 *           type: string
 *           format: email
 *           description: Correo de la coordinadora asociada (opcional)
 *     SedeUpdate:
 *       type: object
 *       properties:
 *         convocatoria:
 *           $ref: '#/components/schemas/Sede/properties/convocatoria'
 *         num_grupos:
 *           $ref: '#/components/schemas/Sede/properties/num_grupos'
 *         fecha:
 *           $ref: '#/components/schemas/Sede/properties/fecha'
 *         nombre:
 *           $ref: '#/components/schemas/Sede/properties/nombre'
 *         aceptado:
 *           $ref: '#/components/schemas/Sede/properties/aceptado'
 *         datos_validados:
 *           $ref: '#/components/schemas/Sede/properties/datos_validados'
 */

/**
 * @swagger
 * /sede:
 *   post:
 *     summary: Registrar una nueva sede
 *     description: Crea una nueva sede y registra automáticamente los roles asociados (coordinador, mentora, etc.)
 *     tags: [sede]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SedeInput'
 *     responses:
 *       201:
 *         description: Sede creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 sede:
 *                   $ref: '#/components/schemas/Sede'
 *                 gruposCreados:
 *                   type: integer
 *       400:
 *         description: Faltan campos obligatorios
 *       500:
 *         description: Error del servidor
 */
router.post("/", async (req: Request, res: Response) => {
    try {
        const { 
            convocatoria, 
            num_grupos, 
            fecha, 
            nombre, 
            coordinadornombre, 
            coordinadorcorreo, 
            mentoranombre, 
            mentoracorreo, 
            informantenombre, 
            informantecorreo, 
            asociadanombre, 
            asociadacorreo 
        } = req.body;
        
        // Validar campos obligatorios
        if (!convocatoria || !num_grupos || !fecha || !nombre) {
            throw new Error("Faltan campos obligatorios: convocatoria, num_grupos, fecha o nombre");
        }

        const { data, error } = await supabase
            .from("sede")
            .insert([
                {
                    convocatoria,
                    num_grupos,
                    fecha,
                    nombre,
                },
            ])
            .select();

        if (error) throw error;

        const sedeId = data[0].id_sede;
        console.log(sedeId);

        // Función auxiliar para hacer peticiones POST solo si los datos existen
        const postIfData = async (url: string, data: any, roleName: string) => {
            if (data.nombre && data.correo) {
                try {
                    await axios.post(url, data, {
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    console.log(`${roleName} registrado exitosamente`);
                } catch (error) {
                    console.error(`Error al registrar el/la ${roleName}:`, error);
                    // Puedes decidir si quieres lanzar el error o continuar
                }
            } else {
                console.log(`No se proporcionaron datos para ${roleName}, omitiendo registro`);
            }
        };

        // Registrar coordinador si hay datos
        if (coordinadornombre && coordinadorcorreo) {
            const credenciales = generarCredenciales(coordinadornombre);
            await postIfData('http://localhost:3000/coordinador', {
                nombre: coordinadornombre,
                correo: coordinadorcorreo,
                telefono: "pendiente",
                username: credenciales.username,
                password: credenciales.password,
                id_sede: sedeId
            }, "coordinador");
            
            if (credenciales.username && credenciales.password) {
                console.log("Con user: ", credenciales.username);
                console.log("Con password: ", credenciales.password);
            }
        }

        // Registrar mentora si hay datos
        if (mentoranombre && mentoracorreo) {
            await postIfData('http://localhost:3000/mentora/inicial', {
                nombre: mentoranombre,
                correo: mentoracorreo,
                id_sede: sedeId
            }, "mentora");
        }

        // Registrar informante si hay datos
        if (informantenombre && informantecorreo) {
            await postIfData('http://localhost:3000/informante', {
                nombre: informantenombre,
                correo: informantecorreo,
                id_sede: sedeId
            }, "informante");
        }

        // Registrar coordinadora asociada si hay datos
        if (asociadanombre && asociadacorreo) {
            await postIfData('http://localhost:3000/coordinadoraasociada', {
                nombre: asociadanombre,
                correo: asociadacorreo,
                id_sede: sedeId
            }, "coordinadora asociada");
        }

        res.status(201).json({ 
            message: `Sede creada con ${num_grupos} grupos`, 
            sede: data[0],
            gruposCreados: num_grupos
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /sede/coordinador/{id}:
 *   get:
 *     summary: Obtener sede para un coordinador
 *     description: Retorna los detalles de una sede específica para un coordinador
 *     tags: [sede]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la sede
 *     responses:
 *       200:
 *         description: Detalles de la sede
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 existe:
 *                   type: boolean
 *                 muestra:
 *                   $ref: '#/components/schemas/Sede'
 *       404:
 *         description: Sede no encontrada
 */
router.get(
    '/coordinador/:id',
    async (
        req: Request,
        res: Response
    ) => {
        const { id } = req.params
        const { data, error } = await supabase
        .from("sede")
        .select('*')
        .eq("id_sede", id)
        
        if (error) {
            res.status(404).json({ existe: false, mensaje: `Tabla no encontrada`, error: error.message })
        } else {
            res.status(200).json({ existe: true, muestra: data })
        }
    }
)

/**
 * @swagger
 * /sede/superusuario:
 *   get:
 *     summary: Obtener todas las sede (Superusuario)
 *     description: Retorna una lista de todas las sede registradas en el sistema
 *     tags: [sede]
 *     responses:
 *       200:
 *         description: Lista de sede
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 existe:
 *                   type: boolean
 *                 muestra:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Sede'
 *       404:
 *         description: No se encontraron sede
 */

router.get(
    '/superusuario',
    async (
        req: Request,
        res: Response
    ) => {
        const { id } = req.params
        const { data, error } = await supabase
        .from("sede")
        .select('*')        
        if (error) {
            res.status(404).json({ existe: false, mensaje: `Tabla no encontrada`, error: error.message })
        } else {
            res.status(200).json({ existe: true, muestra: data })
        }
    }
)

/**
 * @swagger
 * /sede/superusuario/{id}:
 *   get:
 *     summary: Obtener una sede específica (Superusuario)
 *     description: Retorna los detalles de una sede específica por su ID
 *     tags: [sede]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la sede
 *     responses:
 *       200:
 *         description: Detalles de la sede
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 existe:
 *                   type: boolean
 *                 muestra:
 *                   $ref: '#/components/schemas/Sede'
 *       404:
 *         description: Sede no encontrada
 */

router.get(
    '/superusuario/:id',
    async (
        req: Request,
        res: Response
    ) => {
        const { id } = req.params
        const { data, error } = await supabase
        .from("sede")
        .select('*')
        .eq("id_sede", id)     
        if (error) {
            res.status(404).json({ existe: false, mensaje: `Tabla no encontrada`, error: error.message })
        } else {
            res.status(200).json({ existe: true, muestra: data })
        }
    }
)

/**
 * @swagger
 * /sede/{id}:
 *   delete:
 *     summary: Eliminar una sede
 *     description: Elimina una sede existente del sistema
 *     tags: [sede]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la sede a eliminar
 *     responses:
 *       200:
 *         description: Sede eliminada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Sede'
 *       400:
 *         description: ID no proporcionado
 *       404:
 *         description: Sede no encontrada
 *       500:
 *         description: Error del servidor
 */
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id) {
            res.status(400).json({ error: "Se requiere un ID para eliminar el registro" });
            return;
        }

        const { data: existingData, error: fetchError } = await supabase
            .from("sede")
            .select("id_sede")
            .eq("id_sede", id)
            .maybeSingle()

        if (fetchError) throw fetchError;

        if (!existingData) {
            res.status(404).json({ error: "El registro con el ID proporcionado no existe" });
            return;
        }

        const { data, error } = await supabase
            .from("sede")
            .delete()
            .eq("id_sede", id);

        if (error) throw error;

        res.status(200).json({ message: "sede eliminada con éxito", data });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Error en el servidor" });
    }
});

/**
 * @swagger
 * /sede/{id}:
 *   patch:
 *     summary: Actualizar una sede
 *     description: Actualiza los campos de una sede existente
 *     tags: [sede]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la sede a actualizar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SedeUpdate'
 *     responses:
 *       200:
 *         description: Sede actualizada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Sede'
 *       400:
 *         description: Datos de entrada inválidos
 *       404:
 *         description: Sede no encontrada
 *       500:
 *         description: Error del servidor
 */
router.patch("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updateFields = req.body;

        if (!id) {
            res.status(400).json({ error: "Se requiere un ID para modificar el registro" });
            return;
        }

        if (Object.keys(updateFields).length === 0) {
            res.status(400).json({ error: "No se proporcionaron datos para actualizar" });
            return;
        }

        const { data: existingData, error: fetchError } = await supabase
            .from("sede")
            .select("id_sede")
            .eq("id_sede", id)
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!existingData) {
            res.status(404).json({ error: "El registro con el ID proporcionado no existe" });
            return;
        }

        const { data, error } = await supabase
            .from("sede")
            .update(updateFields)
            .eq("id_sede", id)
            .select();

        if (error) throw error;

        res.status(200).json({ message: "sede actualizada con éxito", data });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Error en el servidor" });
    }
});


/**
 * @swagger
 * /sede/consulta:
 *   get:
 *     summary: Consulta dinámica de sede
 *     description: Retorna columnas específicas de todas las sede
 *     tags: [sede]
 *     parameters:
 *       - in: query
 *         name: columnas
 *         required: true
 *         schema:
 *           type: string
 *         description: Lista de columnas separadas por comas (ej. id_sede,nombre)
 *     responses:
 *       200:
 *         description: Datos solicitados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 muestra:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Parámetros inválidos
 *       404:
 *         description: Error en la consulta
 */
router.get(
    '/consulta',
    async (
        req: Request,
        res: Response
    ):Promise<any> =>{
        const { columnas } = req.query;

        if (!columnas) {
            return res.status(400).json({ error: "Debes proporcionar al menos una columna para seleccionar." });
        }

        const columnasArray = (columnas as string).split(",").map(col => col.trim());
        

        const { data, error } = await supabase
        .from("sede")
        .select(columnasArray.join(","))

        if (error) {
            res.status(404).json({mensaje: `Error al ejectuar el proceso`, error: error.message })
        } else {
            res.status(200).json({ success: true, muestra: data })
        }
    }
)

/**
 * @swagger
 * /sede/consulta/especifica/{id}:
 *   get:
 *     summary: Consulta dinámica de una sede específica
 *     description: Retorna columnas específicas de una sede por su ID
 *     tags: [sede]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la sede
 *       - in: query
 *         name: columnas
 *         required: true
 *         schema:
 *           type: string
 *         description: Lista de columnas separadas por comas (ej. id_sede,nombre)
 *     responses:
 *       200:
 *         description: Datos solicitados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 muestra:
 *                   type: object
 *       400:
 *         description: Parámetros inválidos
 *       404:
 *         description: Error en la consulta
 */
router.get(
    '/consulta/especifica/:id',
    async (
        req: Request,
        res: Response
    ):Promise<any> =>{
        const { id } = req.params
        const { columnas } = req.query;

        if (!columnas) {
            return res.status(400).json({ error: "Debes proporcionar al menos una columna para seleccionar." });
        }

        const columnasArray = (columnas as string).split(",").map(col => col.trim());
        

        const { data, error } = await supabase
        .from("sede")
        .select(columnasArray.join(","))
        .eq("id_sede", id)

        if (error) {
            res.status(404).json({mensaje: `Error al ejectuar el proceso`, error: error.message })
        } else {
            res.status(200).json({ success: true, muestra: data })
        }
    }
)

/**
 * @swagger
 * /sede/consulta/especifica/nombre/{nombre}:
 *   get:
 *     summary: Consulta dinámica de una sede por nombre
 *     description: Retorna columnas específicas de una sede por su nombre
 *     tags: [sede]
 *     parameters:
 *       - in: path
 *         name: nombre
 *         required: true
 *         schema:
 *           type: string
 *         description: Nombre de la sede
 *       - in: query
 *         name: columnas
 *         required: true
 *         schema:
 *           type: string
 *         description: Lista de columnas separadas por comas (ej. id_sede,nombre)
 *     responses:
 *       200:
 *         description: Datos solicitados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 muestra:
 *                   type: object
 *       400:
 *         description: Parámetros inválidos
 *       404:
 *         description: Error en la consulta
 */
router.get(
    '/consulta/especifica/nombre/:nombre',
    async (
        req: Request,
        res: Response
    ):Promise<any> =>{
        const { nombre } = req.params
        const { columnas } = req.query;

        if (!columnas) {
            return res.status(400).json({ error: "Debes proporcionar al menos una columna para seleccionar." });
        }

        const columnasArray = (columnas as string).split(",").map(col => col.trim());
        

        const { data, error } = await supabase
        .from("sede")
        .select(columnasArray.join(","))
        .eq("nombre", nombre)

        if (error) {
            res.status(404).json({mensaje: `Error al ejectuar el proceso`, error: error.message })
        } else {
            res.status(200).json({ success: true, muestra: data })
        }
    }
)

/**
 * @swagger
 * /sede/aceptado/{id}:
 *   patch:
 *     summary: Aceptar una sede
 *     description: Marca una sede como aceptada y crea los grupos correspondientes
 *     tags: [sede]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la sede a aceptar
 *     responses:
 *       200:
 *         description: Sede aceptada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Sede'
 *       400:
 *         description: ID no proporcionado
 *       404:
 *         description: Sede no encontrada
 *       500:
 *         description: Error del servidor
 */
router.patch("/aceptado/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            res.status(400).json({ error: "Se requiere un ID para modificar el registro" });
            return;
        }

        const { data: existingData, error: fetchError } = await supabase
            .from("sede")
            .select("id_sede")
            .eq("id_sede", id)
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!existingData) {
            res.status(404).json({ error: "El registro con el ID proporcionado no existe" });
            return;
        }
        const { data, error } = await supabase
            .from("sede")
            .update({ aceptado: true })
            .eq("id_sede", id)
            .select();

        if (error) throw error;

        const { data: grupos, error: gruposerror } = await supabase
            .from("sede")
            .select("num_grupos")
            .eq("id_sede", id)
            .single();

        if (gruposerror) throw gruposerror;

        const { data: coordinadormail, error: coordinadormailerror } = await supabase
        .from("coordinador")
        .select("id_coordinador")
        .eq("id_sede", id)
        .maybeSingle();

        if (coordinadormailerror) throw coordinadormailerror;

        console.log("este es el id de la coordinador: ", coordinadormail)


        const groupPromises = [];
        for (let i = 0; i < grupos.num_grupos; i++) {
            groupPromises.push(
                supabase
                    .from("grupo")
                    .insert([
                        {
                            id_sede: id,
                            idioma: null,
                            nivel: null,
                            cupo: null,
                            modalidad: null
                        }
                    ])
            );
        }

        const groupResults = await Promise.all(groupPromises);
        groupResults.forEach(result => {
            if (result.error) throw result.error;
        });


        try {
            await axios.post('http://localhost:3000/mail/enviar-correo-coordinadora-aceptado', {
                destinatarios: [{
                    id: coordinadormail?.id_coordinador,
                    tabla: "coordinador"
                }],
                asunto: "¡Felicidades! tu sede fue aceptada",
                contenido: "Nos complace informarte que tu sede fue aceptada."
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        } catch (emailError) {
            console.error("Error al enviar el correo:", emailError);
        }

        res.status(200).json({ message: "Campo 'aceptado' actualizado con éxito", data });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Error en el servidor" });
    }
});


/**
 * @swagger
 * /sede/rechazado/{id}:
 *   patch:
 *     summary: Rechazar una sede
 *     description: Marca una sede como rechazada
 *     tags: [sede]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la sede a rechazar
 *     responses:
 *       200:
 *         description: Sede rechazada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Sede'
 *       400:
 *         description: ID no proporcionado
 *       404:
 *         description: Sede no encontrada
 *       500:
 *         description: Error del servidor
 */
router.patch("/rechazado/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            res.status(400).json({ error: "Se requiere un ID para modificar el registro" });
            return;
        }

        const { data: existingData, error: fetchError } = await supabase
            .from("sede")
            .select("id_sede")
            .eq("id_sede", id)
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!existingData) {
            res.status(404).json({ error: "El registro con el ID proporcionado no existe" });
            return;
        }
        const { data, error } = await supabase
            .from("sede")
            .update({ aceptado: false })
            .eq("id_sede", id)
            .select();

        if (error) throw error;

        const { data: coordinadormail, error: coordinadormailerror } = await supabase
        .from("coordinador")
        .select("id_coordinador")
        .eq("id_sede", id)
        .maybeSingle();

        if (coordinadormailerror) throw coordinadormailerror;

        console.log("este es el id de la coordinador: ", coordinadormail)


        try {
            await axios.post('http://localhost:3000/mail/enviar-correo-coordinadora-rechazado', {
                destinatarios: [{
                    id: coordinadormail?.id_coordinador,
                    tabla: "coordinador"
                }],
                asunto: "¡Felicidades! tu sede no fue aceptada",
                contenido: "Nos complace informarte que tu sede no fue aceptada."
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        } catch (emailError) {
            console.error("Error al enviar el correo:", emailError);
        }

        res.status(200).json({ message: "Campo 'aceptado' actualizado con éxito", data });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Error en el servidor" });
    }
});


/**
 * @swagger
 * /sede/validado/{id}:
 *   patch:
 *     summary: Validar una sede
 *     description: Marca una sede como validada
 *     tags: [sede]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la sede a validar
 *     responses:
 *       200:
 *         description: Sede validada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Sede'
 *       400:
 *         description: ID no proporcionado
 *       404:
 *         description: Sede no encontrada
 *       500:
 *         description: Error del servidor
 */
router.patch("/validado/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            res.status(400).json({ error: "Se requiere un ID para modificar el registro" });
            return;
        }

        const { data: existingData, error: fetchError } = await supabase
            .from("sede")
            .select("id_sede")
            .eq("id_sede", id)
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!existingData) {
            res.status(404).json({ error: "El registro con el ID proporcionado no existe" });
            return;
        }
        const { data, error } = await supabase
            .from("sede")
            .update({ datos_validados: true })
            .eq("id_sede", id)
            .select();

        if (error) throw error;

        res.status(200).json({ message: "Campo 'aceptado' actualizado con éxito", data });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Error en el servidor" });
    }
});


/**
 * @swagger
 * /sede/novalidado/{id}:
 *   patch:
 *     summary: Invalidar una sede
 *     description: Marca una sede como no validada
 *     tags: [sede]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la sede a invalidar
 *     responses:
 *       200:
 *         description: Sede invalidada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Sede'
 *       400:
 *         description: ID no proporcionado
 *       404:
 *         description: Sede no encontrada
 *       500:
 *         description: Error del servidor
 */
router.patch("/novalidado/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            res.status(400).json({ error: "Se requiere un ID para modificar el registro" });
            return;
        }

        const { data: existingData, error: fetchError } = await supabase
            .from("sede")
            .select("id_sede")
            .eq("id_sede", id)
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!existingData) {
            res.status(404).json({ error: "El registro con el ID proporcionado no existe" });
            return;
        }
        const { data, error } = await supabase
            .from("sede")
            .update({ datos_validados: false })
            .eq("id_sede", id)
            .select();

        if (error) throw error;

        res.status(200).json({ message: "Campo 'aceptado' actualizado con éxito", data });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Error en el servidor" });
    }
});


/**
 * @swagger
 * /sede/consulta/especifica:
 *   get:
 *     summary: Consulta dinámica por múltiples IDs
 *     description: Retorna columnas específicas de múltiples sede por sus IDs
 *     tags: [sede]
 *     parameters:
 *       - in: query
 *         name: ids
 *         required: true
 *         schema:
 *           type: string
 *         description: Lista de IDs separados por comas (ej. 1,2,3)
 *       - in: query
 *         name: columnas
 *         required: true
 *         schema:
 *           type: string
 *         description: Lista de columnas separadas por comas (ej. nombre,convocatoria)
 *     responses:
 *       200:
 *         description: Datos solicitados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 muestra:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Parámetros inválidos
 *       404:
 *         description: Error en la consulta
 */
router.get(
    '/consulta/especifica/',
    async (
        req: Request,
        res: Response
    ): Promise<any> => {
        const { ids, columnas } = req.query;

        if (!ids) {
            return res.status(400).json({ error: "Debes proporcionar al menos un ID para buscar." });
        }

        if (!columnas) {
            return res.status(400).json({ error: "Debes proporcionar al menos una columna para seleccionar." });
        }

        const idsArray = (ids as string).split(",").map(id => id.trim());
        const columnasArray = (columnas as string).split(",").map(col => col.trim());

        const { data, error } = await supabase
            .from("sede")
            .select(columnasArray.join(","))
            .in("id_sede", idsArray);

        if (error) {
            res.status(404).json({ mensaje: `Error al ejecutar el proceso`, error: error.message })
        } else {
            res.status(200).json({ success: true, muestra: data })
        }
    }
);


export default router;