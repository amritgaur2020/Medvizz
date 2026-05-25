import { NextResponse } from 'next/server';
import { listR2Models, deleteModelFromR2, getR2PublicUrl } from '@/lib/r2';

/**
 * GET /api/r2-models
 * Lists all 3D models stored in Cloudflare R2.
 * Returns: { models: [{ key, modelUrl, previewUrl, size, lastModified }] }
 */
export async function GET() {
  try {
    const objects = await listR2Models();

    const models = objects.map((obj) => {
      // Extract modelId from key like "models/model_1234567890.glb"
      const filename = obj.key.split('/').pop() || '';
      const modelId = filename.replace('.glb', '');

      return {
        modelId,
        key: obj.key,
        modelUrl: getR2PublicUrl(obj.key),
        previewUrl: (() => {
          try { return getR2PublicUrl(`previews/${modelId}.png`); } catch { return null; }
        })(),
        size: obj.size,
        lastModified: obj.lastModified,
      };
    });

    return NextResponse.json({ models });
  } catch (err: any) {
    console.error('[r2-models GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/r2-models?modelId=<modelId>
 * Deletes a model and its preview from R2.
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const modelId = searchParams.get('modelId');

    if (!modelId) {
      return NextResponse.json({ error: 'modelId is required' }, { status: 400 });
    }

    await deleteModelFromR2(modelId);
    return NextResponse.json({ success: true, deleted: modelId });
  } catch (err: any) {
    console.error('[r2-models DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
