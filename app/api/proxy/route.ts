import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy para imágenes externas (FAL AI)
 * Evita problemas de CORS/CSP sirviendo las imágenes desde el mismo origen
 * 
 * Uso: /api/proxy?url=https://v3b.fal.media/files/...
 */
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url");
    
    if (!url) {
      return NextResponse.json(
        { error: "Missing url parameter" },
        { status: 400 }
      );
    }

    // Validar que sea una URL de FAL, FASHN o Google Cloud Storage
    const allowedDomains = ["fal.media", "fal.ai", "fashn.ai", "storage.googleapis.com"];
    const isAllowed = allowedDomains.some(domain => url.includes(domain));
    
    if (!isAllowed) {
      return NextResponse.json(
        { error: "Invalid URL - only FAL/FASHN/GCS media URLs are allowed" },
        { status: 403 }
      );
    }

    console.log("[Proxy] Fetching image from:", url);

    // Descargar la imagen desde FAL/FASHN con headers de navegador
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": url,
      },
    });

    if (!response.ok) {
      console.error("[Proxy] Upstream fetch failed:", response.status, response.statusText);
      return NextResponse.json(
        { 
          error: "Failed to fetch image from upstream",
          status: response.status,
          statusText: response.statusText
        },
        { status: 502 }
      );
    }

    // Obtener el contenido y headers relevantes
    const contentType = response.headers.get("content-type") || "image/png";
    const imageBuffer = await response.arrayBuffer();

    console.log("[Proxy] Image fetched successfully:", imageBuffer.byteLength, "bytes");

    // Servir la imagen con headers apropiados
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable", // Cache por 1 año
        "Access-Control-Allow-Origin": "*", // Permitir CORS si se necesita
      },
    });
  } catch (error: any) {
    console.error("[Proxy] Error:", error);
    return NextResponse.json(
      { 
        error: "Proxy error",
        message: error.message || "Unknown error"
      },
      { status: 500 }
    );
  }
}
