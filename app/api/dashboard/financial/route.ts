import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Configuración de precios y planes
const CONFIG = {
  capacidadAPI: 100000,
  costoPorToken: 0.002,
  precioPlanes: {
    enterprise: 299,
    professional: 99,
    starter: 29,
    free: 0,
  },
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get("timeRange") || "7d";

    // Calcular fecha de inicio según el rango
    const startDate = new Date();
    switch (timeRange) {
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    // Obtener todos los clientes con sus generaciones
    const clientes = await prisma.client.findMany({
      where: {
        active: true,
      },
      include: {
        generations: {
          where: {
            createdAt: {
              gte: startDate,
            },
          },
        },
        _count: {
          select: {
            generations: {
              where: {
                createdAt: {
                  gte: startDate,
                },
              },
            },
          },
        },
      },
    });

    // Procesar datos de clientes
    const clientesData = clientes.map((cliente) => {
      const generaciones = cliente._count.generations;
      const creditosRestantes = cliente.credits - cliente.creditsUsed;
      const porcentajeCreditos =
        cliente.credits > 0
          ? ((cliente.creditsUsed / cliente.credits) * 100).toFixed(1)
          : "0";

      return {
        id: cliente.id,
        nombre: cliente.name,
        plan: cliente.tier,
        creditosTotales: cliente.credits,
        creditosConsumidos: cliente.creditsUsed,
        creditosRestantes: creditosRestantes,
        generaciones: generaciones,
        ultimaCompra: cliente.lastPurchaseDate?.toISOString().split("T")[0] || "N/A",
        activo: cliente.active,
        porcentajeCreditos: parseFloat(porcentajeCreditos),
        ingresosMensuales: cliente.monthlyRevenue || CONFIG.precioPlanes[cliente.tier as keyof typeof CONFIG.precioPlanes] || 0,
      };
    });

    // Ordenar por generaciones descendente
    clientesData.sort((a, b) => b.generaciones - a.generaciones);

    // Calcular KPIs
    const usuariosActivos = clientes.filter((c) => c.active).length;
    const totalLlamadasAPI = clientesData.reduce(
      (sum, c) => sum + c.generaciones,
      0
    );
    const ingresosLicencia = clientesData.reduce(
      (sum, c) => sum + c.ingresosMensuales,
      0
    );
    const creditosTotalesVendidos = clientes.reduce(
      (sum, c) => sum + c.credits,
      0
    );
    const ventaCreditos = creditosTotalesVendidos * CONFIG.costoPorToken;

    // Calcular distribución de planes
    const planCounts = clientes.reduce(
      (acc, cliente) => {
        const tier = cliente.tier || "free";
        acc[tier] = (acc[tier] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const totalClients = clientes.length || 1;
    const distribucionPlanes = {
      enterprise: ((planCounts.enterprise || 0) / totalClients) * 100,
      professional: ((planCounts.professional || 0) / totalClients) * 100,
      starter: ((planCounts.starter || 0) / totalClients) * 100,
      free: ((planCounts.free || 0) / totalClients) * 100,
    };

    // Calcular alertas de recarga (clientes con créditos < 10%)
    const alertasRecarga = clientesData.filter(
      (c) =>
        c.creditosTotales > 0 &&
        (c.creditosRestantes / c.creditosTotales) * 100 < 10
    ).length;

    // Calcular porcentaje de uso de API
    const porcentajeAPI = (totalLlamadasAPI / CONFIG.capacidadAPI) * 100;

    // Calcular comparación con período anterior (simplificado)
    const clientesPeriodoAnterior = clientes.length;
    const cambioUsuarios = clientesPeriodoAnterior > 0 ? 12 : 0; // Simulado, puede calcularse con datos históricos

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          usuariosActivos: {
            valor: usuariosActivos,
            cambio: cambioUsuarios,
          },
          llamadasAPI: {
            valor: totalLlamadasAPI,
            capacidad: CONFIG.capacidadAPI,
            porcentaje: porcentajeAPI.toFixed(1),
          },
          ingresosLicencia: {
            valor: ingresosLicencia,
            descripcion: "Suscripciones recurrentes",
          },
          ventaCreditos: {
            valor: ventaCreditos.toFixed(2),
            descripcion: "Adelantos completados",
          },
        },
        clientes: clientesData,
        distribucionPlanes: distribucionPlanes,
        resumenCuota: {
          porcentajeAPI: porcentajeAPI.toFixed(1),
          creditosVendidos: creditosTotalesVendidos,
          costoPorToken: CONFIG.costoPorToken,
        },
        alertasRecarga: alertasRecarga,
        config: CONFIG,
      },
    });
  } catch (error: any) {
    console.error("Error fetching financial data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al obtener datos financieros",
      },
      { status: 500 }
    );
  }
}
