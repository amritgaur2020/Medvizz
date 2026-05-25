import { NextResponse } from 'next/server';
import { getFileFromR2 } from '@/lib/r2';

/**
 * GET /api/r2-file?key=<key>
 *
 * Downloads and streams a file from the Cloudflare R2 bucket.
 * This acts as a secure proxy to serve GLB files and preview images
 * directly to the client without requiring a public bucket or custom domain.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'key parameter is required' }, { status: 400 });
    }

    // Only allow access to models/, previews/, and metadata/ folders to prevent directory traversal
    if (!key.startsWith('models/') && !key.startsWith('previews/') && !key.startsWith('metadata/')) {
      console.warn('[r2-file] Blocked invalid key path request:', key);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    console.log('[r2-file] Fetching key from R2:', key);
    const file = await getFileFromR2(key);

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Determine cache control and content disposition
    const isModel = key.endsWith('.glb');
    const cacheControl = isModel 
      ? 'public, max-age=31536000, immutable' 
      : 'public, max-age=86400, must-revalidate';

    return new Response(file.bytes, {
      status: 200,
      headers: {
        'Content-Type': file.contentType,
        'Content-Length': String(file.bytes.length),
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': cacheControl,
      },
    });
  } catch (err: any) {
    console.error('[r2-file GET] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
