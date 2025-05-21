import { Request, Response, NextFunction } from "express";
import formsRouter from "./forms";
import dotenv from "dotenv";

dotenv.config();

// Mock antes del require
jest.mock("../supabaseClient", () => ({
    supabase: {
        from: jest.fn().mockReturnValue({
            update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
            }),
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                        data: { status: true },
                        error: null
                    })
                })
            })
        })
    }
}));

// Importar luego del mock
const { supabase } = require("../supabaseClient");

describe("Tests de Mock para /forms", () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: jest.MockedFunction<NextFunction>;
    let responseObject: any;

    beforeEach(() => {
        mockRequest = {};
        responseObject = null;
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockImplementation((result) => {
                responseObject = result;
                return mockResponse;
            }),
        };
        mockNext = jest.fn();
    });

    const executeRouteHandler = async (path: string, method: "get" | "post") => {
        const layer = formsRouter.stack.find(
            (layer) => layer.route?.path === path && (layer.route as any).methods[method]
        );
        if (!layer?.route?.stack?.[0]) throw new Error(`Ruta ${method} ${path} no encontrada`);
        await layer.route.stack[0].handle(
            mockRequest as Request,
            mockResponse as Response,
            mockNext
        );
    };

    // TEST 1 - Activar formulario exitosamente
    it("Actualiza estado del formulario correctamente", async () => {
        mockRequest.body = { form: "sedes", status: true };

        await executeRouteHandler("/actualizar-formulario", "post");

        expect(mockResponse.json).toHaveBeenCalledWith({
            success: true,
            message: 'Formulario "sedes" actualizado.',
        });
    });

    // TEST 2 - Error al actualizar formulario
    it("Devuelve error si falla actualización de supabase", async () => {
        supabase.from().update().eq.mockResolvedValueOnce({
            error: { message: "Fallo DB" }
        });

        mockRequest.body = { form: "participantes", status: false };

        await executeRouteHandler("/actualizar-formulario", "post");

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(responseObject).toEqual({
            success: false,
            error: "Fallo DB"
        });
    });

    // TEST 3 - Verifica estado de un formulario
    it("Devuelve estado actual de un formulario", async () => {
        supabase.from().select().eq().single.mockResolvedValueOnce({
            data: { status: true },
            error: null
        });

        mockRequest.body = { form: "colaboradoras" };

        await executeRouteHandler("/verificar-formulario", "post");

        expect(mockResponse.json).toHaveBeenCalledWith({
            success: true,
            form: "colaboradoras",
            status: true
        });
    });

    // TEST 4 - Error al verificar estado
    it("Devuelve error si falla la consulta de estado", async () => {
        supabase.from().select().eq().single.mockResolvedValueOnce({
            data: null,
            error: { message: "Error al consultar" }
        });

        mockRequest.body = { form: "participantes" };

        await executeRouteHandler("/verificar-formulario", "post");

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(responseObject).toEqual({
            success: false,
            error: "Error al consultar"
        });
    });
});
