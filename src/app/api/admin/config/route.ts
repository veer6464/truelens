import { NextRequest, NextResponse } from 'next/server';
import { getAppConfig, saveAppConfig } from '@/lib/config';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'truelens-admin';

// Helper to check authentication
function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('x-admin-password') || '';
  return authHeader === ADMIN_PASSWORD;
}

export async function GET(request: NextRequest) {
  // Check if admin is authenticated just to return full config state
  const isAuthenticated = checkAuth(request);

  const config = getAppConfig();
  
  // Return config plus environment information (without exposing keys)
  return NextResponse.json({
    config,
    keysConfigured: {
      gptZero: !!process.env.GPTZERO_API_KEY,
      sightEngine: !!(process.env.SIGHTENGINE_API_USER && process.env.SIGHTENGINE_API_SECRET),
      nvidiaNim: !!process.env.NVIDIA_API_KEY,
      huggingFace: !!(process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY),
    },
    huggingFaceModel: process.env.HUGGINGFACE_IMAGE_MODEL || 'dima806/deepfake_vs_real_image_detection',
    isAuthenticated,
  });
}

export async function POST(request: NextRequest) {
  // Gated behind the admin password
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid admin password.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { textEngine, imageEngine } = body;

    // Validate values
    if (textEngine && textEngine !== 'api' && textEngine !== 'local') {
      return NextResponse.json({ error: 'Invalid textEngine value.' }, { status: 400 });
    }
    if (imageEngine && imageEngine !== 'api' && imageEngine !== 'local') {
      return NextResponse.json({ error: 'Invalid imageEngine value.' }, { status: 400 });
    }

    const updated = saveAppConfig({
      ...(textEngine && { textEngine }),
      ...(imageEngine && { imageEngine }),
    });

    return NextResponse.json({ success: true, config: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update config.' }, { status: 500 });
  }
}
