import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { corsJson } from "@/lib/cors";

/**
 * GET /api/metrics
 *
 * Consulta métricas agregadas o por cliente.
 *
 * Query params:
 * - clientId?: string (filtrar por cliente específico)
 * - from?: string (ISO date, inicio del rango)
 * - to?: string (ISO date, fin del rango)
 * - type?: string (tipo de métrica: GENERATION, UPLOAD, ERROR)
 * - groupBy?: string (agrupar por: day, week, month, client)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const type = searchParams.get("type");
    const groupBy = searchParams.get("groupBy");

    // Build where clause
    const where: any = {};
    
    if (clientId) {
      where.clientId = clientId;
    }
    
    if (type) {
      where.type = type;
    }
    
    if (from || to) {
      where.timestamp = {};
      if (from) {
        where.timestamp.gte = new Date(from);
      }
      if (to) {
        where.timestamp.lte = new Date(to);
      }
    }

    // ── Métricas agregadas generales ──
    if (!groupBy) {
      const metrics = await prisma.metric.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: 1000,
        include: {
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const summary = {
        total: metrics.length,
        byType: await prisma.metric.groupBy({
          by: ["type"],
          where,
          _count: { id: true },
        }),
        avgDuration:
          metrics
            .filter((m) => m.durationMs !== null)
            .reduce((sum, m) => sum + (m.durationMs || 0), 0) /
            (metrics.filter((m) => m.durationMs !== null).length || 1),
        byStatus: metrics.reduce((acc, m) => {
          const status = m.status || "unknown";
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };

      return corsJson({
        success: true,
        data: {
          metrics,
          summary,
        },
      });
    }

    // ── Agrupación por día ──
    if (groupBy === "day") {
      const metrics = await prisma.metric.findMany({
        where,
        orderBy: { timestamp: "asc" },
      });

      const byDay: Record<string, any> = {};
      
      metrics.forEach((m) => {
        const day = m.timestamp.toISOString().split("T")[0];
        if (!byDay[day]) {
          byDay[day] = {
            date: day,
            count: 0,
            success: 0,
            error: 0,
            avgDuration: 0,
            durations: [],
          };
        }
        byDay[day].count++;
        if (m.status === "success") byDay[day].success++;
        if (m.status === "error") byDay[day].error++;
        if (m.durationMs) byDay[day].durations.push(m.durationMs);
      });

      // Calcular promedios
      const result = Object.values(byDay).map((day: any) => ({
        date: day.date,
        count: day.count,
        success: day.success,
        error: day.error,
        avgDuration:
          day.durations.length > 0
            ? Math.round(
                day.durations.reduce((a: number, b: number) => a + b, 0) /
                  day.durations.length
              )
            : 0,
      }));

      return corsJson({
        success: true,
        data: result,
      });
    }

    // ── Agrupación por cliente ──
    if (groupBy === "client") {
      const byClient = await prisma.metric.groupBy({
        by: ["clientId"],
        where,
        _count: { id: true },
        _avg: { durationMs: true },
      });

      // Enriquecer con datos del cliente
      const clientIds = byClient.map((c) => c.clientId);
      const clients = await prisma.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, name: true, email: true },
      });

      const result = byClient.map((c) => {
        const client = clients.find((cl) => cl.id === c.clientId);
        return {
          clientId: c.clientId,
          clientName: client?.name || "Unknown",
          clientEmail: client?.email,
          count: c._count.id,
          avgDuration: Math.round(c._avg.durationMs || 0),
        };
      });

      return corsJson({
        success: true,
        data: result,
      });
    }

    // ── Agrupación por semana ──
    if (groupBy === "week") {
      const metrics = await prisma.metric.findMany({
        where,
        orderBy: { timestamp: "asc" },
      });

      const byWeek: Record<string, any> = {};

      metrics.forEach((m) => {
        const date = new Date(m.timestamp);
        // Get week number (simple: first day of week)
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split("T")[0];

        if (!byWeek[weekKey]) {
          byWeek[weekKey] = {
            week: weekKey,
            count: 0,
            success: 0,
            error: 0,
            durations: [],
          };
        }
        byWeek[weekKey].count++;
        if (m.status === "success") byWeek[weekKey].success++;
        if (m.status === "error") byWeek[weekKey].error++;
        if (m.durationMs) byWeek[weekKey].durations.push(m.durationMs);
      });

      const result = Object.values(byWeek).map((week: any) => ({
        week: week.week,
        count: week.count,
        success: week.success,
        error: week.error,
        avgDuration:
          week.durations.length > 0
            ? Math.round(
                week.durations.reduce((a: number, b: number) => a + b, 0) /
                  week.durations.length
              )
            : 0,
      }));

      return corsJson({
        success: true,
        data: result,
      });
    }

    // Agrupación no reconocida
    return corsJson(
      {
        success: false,
        error: `Agrupación '${groupBy}' no soportada. Usa: day, week, client`,
      },
      400
    );
  } catch (error) {
    console.error("[metrics] Error:", error);
    return corsJson(
      {
        success: false,
        error: "Error al consultar métricas",
      },
      500
    );
  }
}

// CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}