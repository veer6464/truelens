import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limiter';
import { getEngine } from '@/lib/engines/manager';
import { parseDocument } from '@/lib/document-parser';

export async function POST(request: NextRequest) {
  // 1. Get client IP and check rate limiting
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             '127.0.0.1';
             
  const { allowed, remaining } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': '10',
        }
      }
    );
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    
    // Check if it's multipart/form-data (uploads)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const type = formData.get('type') as string; // 'text' | 'image' | 'video'
      const singleFile = formData.get('file') as File | null;
      const multipleFiles = formData.getAll('files') as File[];
      const files: File[] = multipleFiles.length > 0 ? multipleFiles : (singleFile ? [singleFile] : []);

      if (type !== 'video' && files.length === 0) {
        return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
      }

      if (type === 'image') {
        const engine = getEngine('image');

        if (files.length > 1 || formData.get('isBatch') === 'true') {
          // Process all images concurrently in batch
          const items = await Promise.all(
            files.map(async (f) => {
              const buf = Buffer.from(await f.arrayBuffer());
              const detection = await engine.detectImage(buf, f.type);
              return {
                id: `${f.name}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                fileName: f.name,
                fileSize: f.size,
                mimeType: f.type,
                result: detection,
              };
            })
          );

          let aiCount = 0;
          let humanCount = 0;
          let uncertainCount = 0;
          let totalConfidence = 0;

          for (const item of items) {
            if (item.result.verdict === 'ai') aiCount++;
            else if (item.result.verdict === 'human') humanCount++;
            else uncertainCount++;
            totalConfidence += item.result.confidence;
          }

          const averageConfidence = items.length > 0 ? Math.round(totalConfidence / items.length) : 0;

          return NextResponse.json({
            isBatch: true,
            summary: {
              total: items.length,
              aiCount,
              humanCount,
              uncertainCount,
              averageConfidence,
            },
            items,
          }, {
            headers: { 'X-RateLimit-Remaining': remaining.toString() }
          });
        }

        // Single image upload
        const buffer = Buffer.from(await files[0].arrayBuffer());
        const result = await engine.detectImage(buffer, files[0].type);
        return NextResponse.json(result, {
          headers: { 'X-RateLimit-Remaining': remaining.toString() }
        });
      } else if (type === 'video') {
        const frameFiles = formData.getAll('frames') as File[];
        const timestampsRaw = formData.getAll('timestamps') as string[];
        const videoName = (formData.get('videoName') as string) || 'Target Video';
        const duration = Number(formData.get('duration')) || 0;

        if (frameFiles.length === 0) {
          return NextResponse.json({ error: 'No video frames provided for analysis.' }, { status: 400 });
        }

        const engine = getEngine('image');

        const timeline = await Promise.all(
          frameFiles.map(async (frame, idx) => {
            const buf = Buffer.from(await frame.arrayBuffer());
            const detection = await engine.detectImage(buf, frame.type || 'image/jpeg');
            const timestamp = timestampsRaw[idx] || `00:${String(idx * 2).padStart(2, '0')}`;
            return {
              frameIndex: idx,
              timestamp,
              result: detection,
            };
          })
        );

        let aiCount = 0;
        let humanCount = 0;
        let uncertainCount = 0;
        let totalConfidence = 0;
        let peakConfidence = 0;
        let peakTimestamp = timeline[0]?.timestamp || '00:00';

        for (const item of timeline) {
          const conf = item.result.confidence;
          totalConfidence += conf;
          if (item.result.verdict === 'ai') {
            aiCount++;
            if (conf > peakConfidence) {
              peakConfidence = conf;
              peakTimestamp = item.timestamp;
            }
          } else if (item.result.verdict === 'human') {
            humanCount++;
          } else {
            uncertainCount++;
          }
        }

        const averageConfidence = timeline.length > 0 ? Math.round(totalConfidence / timeline.length) : 0;
        
        // Video / Deepfake verdict consensus:
        // If at least 1/3 of frames or any frame with >= 80% AI confidence is found, flag as AI/Deepfake
        let overallVerdict: 'ai' | 'human' | 'uncertain' = 'human';
        if (aiCount >= Math.ceil(timeline.length / 3) || peakConfidence >= 80) {
          overallVerdict = 'ai';
        } else if (aiCount > 0 || uncertainCount > timeline.length / 2) {
          overallVerdict = 'uncertain';
        }

        return NextResponse.json({
          isVideo: true,
          videoName,
          duration,
          summary: {
            overallVerdict,
            averageConfidence,
            peakConfidence: peakConfidence > 0 ? peakConfidence : averageConfidence,
            peakTimestamp,
            aiCount,
            humanCount,
            uncertainCount,
            totalFrames: timeline.length,
          },
          timeline,
        }, {
          headers: { 'X-RateLimit-Remaining': remaining.toString() }
        });
      } else if (type === 'text') {
        // Parse document (TXT, PDF, DOCX) to plain text
        const buffer = Buffer.from(await files[0].arrayBuffer());
        const textContent = await parseDocument(buffer, files[0].type || files[0].name);
        
        if (textContent.trim().length === 0) {
          return NextResponse.json({ error: 'Document was empty.' }, { status: 400 });
        }

        const engine = getEngine('text');
        const result = await engine.detectText(textContent);
        return NextResponse.json(result, {
          headers: { 'X-RateLimit-Remaining': remaining.toString() }
        });
      } else {
        return NextResponse.json({ error: 'Invalid content type request parameter.' }, { status: 400 });
      }
    } 
    
    // Check if it's raw JSON request (pasted text)
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { text } = body;

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return NextResponse.json({ error: 'No text provided.' }, { status: 400 });
      }

      const engine = getEngine('text');
      const result = await engine.detectText(text);
      return NextResponse.json(result, {
        headers: { 'X-RateLimit-Remaining': remaining.toString() }
      });
    }

    return NextResponse.json({ error: 'Unsupported request content type.' }, { status: 415 });
  } catch (error: any) {
    console.error('API Detect Route error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while analyzing the content.' },
      { status: 500 }
    );
  }
}
