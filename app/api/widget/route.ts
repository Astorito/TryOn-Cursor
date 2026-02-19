import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Serve the widget JS from docs/widget-full.js (editable). Fallback to embedded minimal widget.
export async function GET() {
  const filePath = path.join(process.cwd(), 'docs', 'widget-full.js')
  try {
    const code = fs.readFileSync(filePath, 'utf8')
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/6409409d-10bf-4ec6-ac7c-944201295ebb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/widget/route.ts:GET',message:'serving widget from docs/widget-full.js',data:{len: code.length,preview: code.slice(0,200)},timestamp:Date.now(),runId:'pre-fix',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    return new NextResponse(code, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    // log the error + fallback
    // #region agent log
    const errorMessage = err instanceof Error ? err.message : String(err);
    fetch('http://127.0.0.1:7242/ingest/6409409d-10bf-4ec6-ac7c-944201295ebb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/widget/route.ts:GET',message:'failed reading widget file',data:{error: errorMessage},timestamp:Date.now(),runId:'pre-fix',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    const fallback = `(function(){const key=document.currentScript&&document.currentScript.dataset.tryonKey;console.log("TryOn fallback widget. Key:",key);})();`;
    return new NextResponse(fallback, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}