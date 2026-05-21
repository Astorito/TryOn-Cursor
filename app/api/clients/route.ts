import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateApiKey } from "@/lib/auth";

/**
 * CRUD /api/clients
 *
 * GET    — Lista todos los clientes con conteo de generaciones
 * POST   — Crea un nuevo cliente con API key auto-generada
 * DELETE  — Elimina un cliente por id (query param)
 */

// ─── GET /api/clients ───
export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { generations: true } },
        allowedDomains: { select: { domain: true } },
      },
    });

    const formatted = clients.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      apiKey: c.apiKey,
      active: c.active,
      limit: c.limit,
      widgetMode: c.widgetMode,
      usageCount: c._count.generations,
      domains: c.allowedDomains.map((d) => d.domain),
      createdAt: c.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, clients: formatted });
  } catch (error) {
    console.error("[clients] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener clientes" },
      { status: 500 }
    );
  }
}

// ─── POST /api/clients ───
export async function POST(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta configurar DATABASE_URL. Creá .env.local en la raíz con tu conexión PostgreSQL/Supabase.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { name, email, website, limit: clientLimit, domains, widgetMode } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "El nombre es requerido" },
        { status: 400 }
      );
    }

    if (widgetMode && !["fab", "button"].includes(widgetMode)) {
      return NextResponse.json(
        { success: false, error: "widgetMode debe ser 'fab' o 'button'" },
        { status: 400 }
      );
    }

    const apiKey = generateApiKey();
    const createData = {
      name: name.trim(),
      email: email?.trim() || null,
      website: website?.trim() || null,
      apiKey,
      limit: clientLimit || 5000,
      widgetMode: widgetMode || "fab",
      allowedDomains: domains?.length
        ? {
            create: domains.map((d: string) => ({ domain: d.trim() })),
          }
         : undefined,
    };

    const client = await prisma.client.create({
      data: createData,
    });

    return NextResponse.json(
      {
        success: true,
        client: {
          id: client.id,
          name: client.name,
          email: client.email,
          apiKey: client.apiKey,
          limit: client.limit,
          widgetMode: client.widgetMode,
          createdAt: client.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[clients] POST error:", error);
    const errName = (error as Error)?.name;
    const errMessage = (error as Error)?.message ?? "";
    const prismaCode = (error as Error & { code?: string })?.code;
    const isDbUnreachable =
      errName === "PrismaClientInitializationError" ||
      /Can't reach database server|connection refused|ECONNREFUSED|Tenant or user not found|password authentication failed|authentication failed/i.test(
        errMessage
      );
    const isTableMissing = prismaCode === "P2021" || /does not exist in the current database/i.test(errMessage);
    let userMessage = "Error al crear cliente";
    if (isDbUnreachable)
      userMessage = "No se pudo conectar a la base de datos. Revisá que DATABASE_URL sea correcta y que el servidor (ej. Supabase) esté activo y accesible.";
    else if (isTableMissing)
      userMessage = "Las tablas de la base de datos no existen. En la raíz del proyecto ejecutá: npm run prisma:push";
    else
      userMessage = `Error al crear cliente [${prismaCode ?? errName ?? "unknown"}]: ${errMessage.slice(0, 200)}`;
    return NextResponse.json(
      { success: false, error: userMessage },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/clients?id=xxx ───
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID del cliente requerido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { active, widgetMode } = body;

    const updateData: any = {};

    if (typeof active === "boolean") {
      updateData.active = active;
    }

    if (widgetMode !== undefined) {
      if (!["fab", "button"].includes(widgetMode)) {
        return NextResponse.json(
          { success: false, error: "widgetMode debe ser 'fab' o 'button'" },
          { status: 400 }
        );
      }
      updateData.widgetMode = widgetMode;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "Debe proporcionar al menos un campo para actualizar" },
        { status: 400 }
      );
    }

    const updated = await prisma.client.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      client: {
        id: updated.id,
        active: updated.active,
        widgetMode: updated.widgetMode,
      },
    });
  } catch (error) {
    console.error("[clients] PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Error al actualizar cliente" },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/clients?id=xxx ───
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID del cliente requerido" },
        { status: 400 }
      );
    }

    await prisma.client.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Cliente eliminado" });
  } catch (error) {
    console.error("[clients] DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Error al eliminar cliente" },
      { status: 500 }
    );
  }
}
