import { Router, Request, Response } from "express";
import { supabase } from "../supabaseClient";
import dotenv from "dotenv";
import multer from 'multer';
import archiver from 'archiver';
import { PassThrough, Readable } from 'stream';
import axios from 'axios';
import stream from 'stream';

const router = Router();

dotenv.config();

/**
 * @swagger
 * /forms/actualizar-formulario:
 *   post:
 *     summary: Actualizar estado de un formulario
 *     description: Permite actualizar el estado (status) de un formulario específico
 *     tags: [Formularios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               form:
 *                 type: string
 *                 description: Nombre del formulario a actualizar
 *               status:
 *                 type: string
 *                 description: Nuevo estado del formulario
 *             required:
 *               - form
 *               - status
 *     responses:
 *       200:
 *         description: Formulario actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Error al actualizar el formulario
 */


router.post("/actualizar-formulario", async (req, res):Promise<any> => {
    const { form, status } = req.body;

    const { error } = await supabase
      .from("form")
      .update({ status })
      .eq("form", form);
  
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  
    return res.json({ success: true, message: `Formulario "${form}" actualizado.` });
  });
  

/**
 * @swagger
 * /forms/verificar-formulario:
 *   post:
 *     summary: Verificar estado de un formulario
 *     description: Obtiene el estado actual de un formulario específico
 *     tags: [Formularios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               form:
 *                 type: string
 *                 description: Nombre del formulario a verificar
 *             required:
 *               - form
 *     responses:
 *       200:
 *         description: Estado del formulario obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 form:
 *                   type: string
 *                 status:
 *                   type: string
 *       500:
 *         description: Error al obtener el estado del formulario
 */

  router.post("/verificar-formulario", async (req, res):Promise<any> => {
    const { form } = req.body;
  
    const { data, error } = await supabase
      .from("form")
      .select("status")
      .eq("form", form)
      .single();
  
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  
    return res.json({ success: true, form, status: data.status });
  });
/**
 * @swagger
 * /forms/verificar-status-globales:
 *   get:
 *     summary: Obtener estados de todos los formularios
 *     description: Retorna el estado de todos los formularios existentes
 *     tags: [Formularios]
 *     responses:
 *       200:
 *         description: Lista de estados de formularios obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Error al obtener los estados de los formularios
 */

  router.get("/verificar-status-globales", async (req, res):Promise<any> => {
  
    const { data, error } = await supabase
      .from("form")
      .select("*");
  
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  
    return res.json({ success: true, status: data });
  });

export default router;
