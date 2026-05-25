import { NextResponse } from 'next/server';

/**
 * GET /api/proxy-model?url=<encoded-glb-url>
 *
 * Proxies a Neural4D GLB model through our server so the browser can load it
 * in Three.js GLTFLoader without CORS issues.
 * The COS (cloud object storage) URLs returned by Neural4D may not include
 * CORS headers for our domain, so we fetch server-side and stream back.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const modelUrl = searchParams.get('url');

    if (!modelUrl) {
      return NextResponse.json({ error: 'url parameter is required' }, { status: 400 });
    }

    // Only allow Neural4D COS URLs and Cloudflare R2 public URLs to prevent open-proxy abuse
    const r2PublicUrl = process.env.R2_PUBLIC_URL || '';
    const allowed = [
      'cos.znkj.com',
      'neural4d.com',
      'alb.neural4d.com',
      'cos.ap-',       // Tencent COS regions
      'myqcloud.com',  // Tencent COS
      'r2.dev',        // Cloudflare R2 public buckets
      ...(r2PublicUrl ? [new URL(r2PublicUrl).hostname] : []),
    ];
    const isAllowed = allowed.some(domain => modelUrl.includes(domain));
    if (!isAllowed) {
      console.warn('[proxy-model] Blocked non-allowed URL:', modelUrl);
      return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
    }

    console.log('[proxy-model] Fetching:', modelUrl);
    const upstream = await fetch(modelUrl, {
      headers: { 'User-Agent': 'MedVis/1.0' },
    });

    if (!upstream.ok) {
      console.error('[proxy-model] Upstream error:', upstream.status);
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const buffer = await upstream.arrayBuffer();
    console.log('[proxy-model] Fetched', buffer.byteLength, 'bytes');

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'model/gltf-binary',
        'Content-Length': String(buffer.byteLength),
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: any) {
    console.error('[proxy-model] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
