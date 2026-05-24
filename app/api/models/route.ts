import { NextResponse } from 'next/server';

// Dynamic import for SQLite — gracefully skipped on Vercel serverless
let getGeneratedModels: any = null;
let createGeneratedModel: any = null;
let deleteGeneratedModel: any = null;

try {
  const db = require('@/lib/db');
  getGeneratedModels = db.getGeneratedModels;
  createGeneratedModel = db.createGeneratedModel;
  deleteGeneratedModel = db.deleteGeneratedModel;
} catch (_) {}

export async function GET() {
  try {
    if (!getGeneratedModels) {
      return NextResponse.json({ models: [] });
    }
    const models = getGeneratedModels();
    return NextResponse.json({ models });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { id, topic, prompt, modelUrl, imageUrl, title, userId } = await req.json();
    if (!id || !topic || !prompt || !modelUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!createGeneratedModel) {
      // In Vercel mode without SQLite, we return the model object back so the client can save it in localStorage
      return NextResponse.json({
        success: true,
        isFallback: true,
        model: {
          id,
          topic,
          prompt,
          model_url: modelUrl,
          image_url: imageUrl || null,
          title: title || null,
          user_id: userId || null,
          created_at: new Date().toISOString()
        }
      });
    }

    const model = createGeneratedModel(id, topic, prompt, modelUrl, imageUrl || null, title || null, userId || null);
    return NextResponse.json({ success: true, model });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing model ID' }, { status: 400 });
    }

    if (deleteGeneratedModel) {
      deleteGeneratedModel(id);
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
