import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Serve same widget JS when requested as /api/widget.js
export async function GET() {
  const filePath = path.join(process.cwd(), 'docs', 'widget-full.js')
  try {
    const code = fs.readFileSync(filePath, 'utf8')
    // debug log (pre-fix)
    fetch('http://127.0.0.1:7242/ingest/6409409d-10bf-4ec6-ac7c-944201295ebb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/widget.js/route.ts:GET',message:'serving widget-js from docs/widget-full.js',data:{len: code.length,preview: code.slice(0,120)},timestamp:Date.now(),runId:'pre-fix',hypothesisId:'H3'})}).catch(()=>{});
    return new NextResponse(code, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    // log error
    const errorMessage = err instanceof Error ? err.message : String(err);
    fetch('http://127.0.0.1:7242/ingest/6409409d-10bf-4ec6-ac7c-944201295ebb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/widget.js/route.ts:GET',message:'failed reading widget file',data:{error: errorMessage},timestamp:Date.now(),runId:'pre-fix',hypothesisId:'H4'})}).catch(()=>{});
    const fallback = `(function(){const key=document.currentScript&&document.currentScript.dataset.tryonKey;console.log("TryOn fallback widget-js. Key:",key);})();`
    return new NextResponse(fallback, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}

