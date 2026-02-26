import { NextRequest } from "next/server";
import { fal } from "@fal-ai/client";
import { corsJson } from "@/lib/cors";
import fs from "fs";
import path from "path";
import os from "os";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

fal.config({ credentials: process.env.FAL_KEY });

/**
 * POST /api/images/upload
 * Pre-uploads a single image to FAL storage and returns the URL.
 * Called in background as soon as user loads an image.
 *
 * Body: { image: string (base64 data URL) }
 * Returns: { success: true, url: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();
    if (!image || !image.startsWith('data:')) {
      return corsJson({ success: false, error: 'Invalid image' }, 400);
    }

    const matches = image.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return corsJson({ success: false, error: 'Invalid base64' }, 400);

    const [, mimeType, base64Data] = matches;
    const buffer = Buffer.from(base64Data, 'base64');
    const ext = mimeType.split('/')[1] || 'jpg';
    const tmpPath = path.join(os.tmpdir(), `preupload_${Date.now()}.${ext}`);
    fs.writeFileSync(tmpPath, buffer);

    try {
      const file = new File([buffer], `image.${ext}`, { type: mimeType });
      const url = await fal.storage.upload(file);
      return corsJson({ success: true, url });
    } finally {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  } catch (error) {
    console.error('[upload] Error:', error);
    return corsJson({ success: false, error: 'Upload failed' }, 500);
  }
}

export async function OPTIONS() {
  return corsJson({}, 200);
}