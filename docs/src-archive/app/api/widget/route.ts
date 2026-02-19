import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Serve widget JS. Prefer the editable file at docs/widget-full.js when present.
export async function GET() {
  const filePath = path.join(process.cwd(), 'docs', 'widget-full.js')
  try {
    const code = fs.readFileSync(filePath, 'utf8')
    return new NextResponse(code, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    // Fallback minimal widget if the file is missing/unreadable
    const fallback = `(function(){const key=document.currentScript&&document.currentScript.dataset.tryonKey;console.log("TryOn fallback widget. Key:",key);})();`
    return new NextResponse(fallback, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}

