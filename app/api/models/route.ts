import { NextResponse } from 'next/server';
import { listR2ModelsWithMetadata, uploadMetadataToR2, deleteModelFromR2 } from '@/lib/r2';

export const dynamic = 'force-dynamic';

/**
 * GET /api/models
 * Lists all generated models directly from Cloudflare R2, populated with metadata.
 */
export async function GET() {
  try {
    const models = await listR2ModelsWithMetadata();
    return NextResponse.json({ models });
  } catch (error: any) {
    console.error('[models GET] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/models
 * Saves model metadata directly into Cloudflare R2 as a JSON file.
 */
export async function POST(req: Request) {
  try {
    const { id, topic, prompt, modelUrl, imageUrl, title, userId } = await req.json();
    if (!id || !topic || !prompt || !modelUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const metadata = {
      id,
      topic,
      prompt,
      model_url: modelUrl,
      image_url: imageUrl || null,
      title: title || topic,
      user_id: userId || 'user_default',
      created_at: new Date().toISOString()
    };

    // Save metadata JSON to R2 alongside the GLB model
    await uploadMetadataToR2(id, metadata);

    return NextResponse.json({ success: true, model: metadata });
  } catch (error: any) {
    console.error('[models POST] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/models?id=<modelId>
 * Deletes the GLB file, preview image, and metadata JSON from Cloudflare R2.
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing model ID' }, { status: 400 });
    }

    // Delete all assets and metadata associated with this model from R2
    await deleteModelFromR2(id);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[models DELETE] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
