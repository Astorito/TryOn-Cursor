import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/widget/config?key=<apiKey>
 *
 * Devuelve la configuración del widget para un cliente específico.
 * Respuesta: { mode: "fab" | "button" }
 *
 * Usado por el widget embebido para saber si debe:
 * - Mostrar un FAB flotante ("fab")
 * - O enganchar elementos con [data-tryon-trigger] ("button")
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get("key");

    if (!apiKey) {
      return NextResponse.json(
        { mode: "fab" },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        }
      );
    }

    const client = await prisma.client.findUnique({
      where: { apiKey },
      select: { widgetMode: true, active: true },
    });

    if (!client || !client.active) {
      return NextResponse.json(
        { mode: "fab" },
        {
          status: 404,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        }
      );
    }

    return NextResponse.json(
      { mode: client.widgetMode },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Cache-Control": "public, max-age=60",
        },
      }
    );
  } catch (error) {
    console.error("[widget/config] GET error:", error);
    return NextResponse.json(
      { mode: "fab" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  );
}
