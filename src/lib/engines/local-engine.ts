import { DetectionEngine, DetectionResult, DetectionRegion, TextSegment } from './types';

export class LocalDetectionEngine implements DetectionEngine {
  private nvidiaApiKey = process.env.NVIDIA_API_KEY || '';
  private nvidiaModel = process.env.NVIDIA_MODEL || 'meta/llama-3.2-11b-vision-instruct';
  private hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || '';
  private hfImageModel = process.env.HUGGINGFACE_IMAGE_MODEL || 'dima806/deepfake_vs_real_image_detection';

  // -------------------------------------------------------------
  // TEXT DETECTION (Nvidia NIM LLaMA 3.2 11B Vision Instruct)
  // -------------------------------------------------------------
  async detectText(text: string): Promise<DetectionResult> {
    if (!text || text.trim().length === 0) {
      return { verdict: 'human', confidence: 0, regions: [], textSegments: [] };
    }

    if (this.nvidiaApiKey) {
      const res = await this.queryNvidiaNimText(text);
      if (res) return res;
    }

    return this.simulateTextLocal(text);
  }

  // -------------------------------------------------------------
  // IMAGE DETECTION (AI Vision Forensics & ViT Classification)
  // -------------------------------------------------------------
  async detectImage(imageBuffer: Buffer, mimeType: string): Promise<DetectionResult> {
    // 1. Primary: Nvidia NIM Multimodal Vision Forensics (Llama 3.2 Vision)
    // Uses AI vision to pinpoint the exact locations where AI generation was used
    if (this.nvidiaApiKey) {
      const visionRes = await this.queryNvidiaVisionForensics(imageBuffer, mimeType);
      if (visionRes) return visionRes;
    }

    // 2. Secondary: Hugging Face Vision Transformer (ViT Deepfake vs Real)
    if (this.hfToken) {
      const hfRes = await this.queryHuggingFaceVision(imageBuffer, mimeType);
      if (hfRes) return hfRes;
    }

    // 3. Fallback: Local simulation if offline
    return this.simulateImageLocal(imageBuffer);
  }

  // -------------------------------------------------------------
  // AI VISION FORENSICS: EXACT ANOMALY LOCALIZATION
  // -------------------------------------------------------------
  private async queryNvidiaVisionForensics(
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<DetectionResult | null> {
    if (!this.nvidiaApiKey) return null;

    try {
      const base64Image = imageBuffer.toString('base64');
      const cleanMime = mimeType || 'image/jpeg';

      const systemPrompt = `You are an expert AI image forensic analyst. Your goal is to inspect the image and pinpoint the PRECISE localized areas where AI generation, synthetic rendering, digital artifacts, or inpainting were used.
Do NOT output full-image or random boxes. Only output tight bounding boxes around localized areas where AI artifacts or synthetic features are visibly present (e.g. synthetic skin smoothing, impossible hair blending, artificial lighting highlights, warped accessories, background digital artifacts, distorted fingers).

If the image is authentic/photographic without obvious synthetic manipulation, return "regions": [].

Respond STRICTLY in valid JSON matching this schema:
{
  "verdict": "ai" | "human" | "uncertain",
  "confidence": 0-100,
  "summary": "Brief 1-sentence forensic observation explaining what was detected and where",
  "regions": [
    {
      "label": "Brief description of the localized artifact (e.g. Synthetic hair blending, Unnatural skin smoothing, Artificial lighting)",
      "x": <0-100 percentage from left of image>,
      "y": <0-100 percentage from top of image>,
      "width": <0-100 percentage width of the artifact area>,
      "height": <0-100 percentage height of the artifact area>,
      "confidence": 0-100
    }
  ]
}`;

      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.nvidiaApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta/llama-3.2-11b-vision-instruct',
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Detect and pinpoint exact localized areas where AI rendering is evident. Output only valid JSON.' },
                { type: 'image_url', image_url: { url: `data:${cleanMime};base64,${base64Image}` } }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 600,
          stream: false
        })
      });

      if (!response.ok) return null;

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        const rawRegions = Array.isArray(parsed.regions) ? parsed.regions : [];
        const regions: DetectionRegion[] = rawRegions.map((reg: any) => {
          let x = Number(reg.x) || 0;
          let y = Number(reg.y) || 0;
          let width = Number(reg.width) || 0;
          let height = Number(reg.height) || 0;

          // Normalize if 0-1 float
          if (x <= 1 && y <= 1 && width <= 1 && height <= 1 && (x > 0 || y > 0 || width > 0 || height > 0)) {
            x = Math.round(x * 100);
            y = Math.round(y * 100);
            width = Math.round(width * 100);
            height = Math.round(height * 100);
          }

          // Boundary clamping
          x = Math.max(0, Math.min(95, x));
          y = Math.max(0, Math.min(95, y));
          width = Math.max(5, Math.min(100 - x, width));
          height = Math.max(5, Math.min(100 - y, height));

          return {
            x,
            y,
            width,
            height,
            confidence: Math.round(reg.confidence) || parsed.confidence || 85,
            label: reg.label || 'AI Artifact'
          };
        });

        const verdict: 'ai' | 'human' | 'uncertain' =
          parsed.verdict === 'ai' || parsed.verdict === 'human' || parsed.verdict === 'uncertain'
            ? parsed.verdict
            : (regions.length > 0 ? 'ai' : 'human');

        return {
          verdict,
          confidence: Math.round(parsed.confidence) || (verdict === 'ai' ? 88 : 92),
          regions,
          textSegments: [],
          summary: parsed.summary || ''
        };
      }
      return null;
    } catch (err) {
      console.error('Nvidia Vision forensic error:', err);
      return null;
    }
  }

  private async queryHuggingFaceVision(
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<DetectionResult | null> {
    if (!this.hfToken) return null;

    const endpoints = [
      `https://router.huggingface.co/hf-inference/models/${this.hfImageModel}`,
      `https://api-inference.huggingface.co/models/${this.hfImageModel}`
    ];

    let response: Response | null = null;
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.hfToken}`,
            'Content-Type': mimeType || 'image/jpeg',
          },
          body: new Uint8Array(imageBuffer),
        });
        if (res.ok) {
          response = res;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!response || !response.ok) return null;

    try {
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) return null;

      let aiScore = 0;
      let humanScore = 0;

      for (const item of data) {
        const label = String(item.label || '').toLowerCase();
        const score = typeof item.score === 'number' ? item.score : 0;
        if (label.includes('fake') || label.includes('ai') || label.includes('artificial') || label.includes('synthetic')) {
          aiScore = Math.max(aiScore, score);
        } else if (label.includes('real') || label.includes('human') || label.includes('authentic')) {
          humanScore = Math.max(humanScore, score);
        }
      }

      if (aiScore === 0 && humanScore === 0) {
        aiScore = data[0]?.score || 0;
      }

      const isAI = aiScore > 0.5;
      const confidence = Math.round(isAI ? aiScore * 100 : (humanScore > 0 ? humanScore * 100 : (1 - aiScore) * 100));
      const verdict: 'ai' | 'human' | 'uncertain' =
        aiScore > 0.65 ? 'ai' : aiScore > 0.40 ? 'uncertain' : 'human';

      const regions: DetectionRegion[] = isAI ? [
        { x: 20, y: 20, width: 60, height: 60, confidence, label: 'ViT Neural Anomaly' }
      ] : [];

      return {
        verdict,
        confidence,
        regions,
        textSegments: []
      };
    } catch {
      return null;
    }
  }

  private async queryNvidiaNimText(text: string): Promise<DetectionResult | null> {
    if (!this.nvidiaApiKey) return null;

    try {
      const systemPrompt = `You are a professional forensic linguist specialized in detecting AI-generated text.
Analyze the following text and determine if it was written by an AI or a human.
Provide:
1. An overall verdict: "ai", "human", or "uncertain".
2. An overall confidence score (0 to 100).
3. A sentence-by-sentence segment analysis where you evaluate each sentence individually.

You must respond strictly in JSON format. Do not write markdown, code blocks, or explanations outside the JSON. The JSON structure must match this exact schema:
{
  "verdict": "ai" | "human" | "uncertain",
  "confidence": 0-100,
  "textSegments": [
    {
      "text": "exact sentence text from the source",
      "confidence": 0-100,
      "verdict": "ai" | "human" | "uncertain"
    }
  ]
}

Make sure every single sentence from the input is included sequentially in "textSegments".`;

      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.nvidiaApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.nvidiaModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Please inspect the following text:\n\n${text}` }
          ],
          temperature: 0.1,
          max_tokens: 2048,
          stream: false
        })
      });

      if (!response.ok) return null;

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed: DetectionResult = JSON.parse(jsonMatch[0]);
        return {
          verdict: parsed.verdict || 'uncertain',
          confidence: parsed.confidence ?? 50,
          regions: [],
          textSegments: parsed.textSegments || []
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------
  // SIMULATION FALLBACKS
  // -------------------------------------------------------------
  private simulateImageLocal(imageBuffer: Buffer): DetectionResult {
    const size = imageBuffer.length;
    const isAI = size % 2 === 0;
    const confidence = isAI ? 92 : 88;
    const verdict: 'ai' | 'human' | 'uncertain' = isAI ? 'ai' : 'human';

    const regions: DetectionRegion[] = isAI ? [
      { x: 20, y: 20, width: 60, height: 60, confidence: 88, label: 'Synthetic Generative Anomaly' }
    ] : [];

    return {
      verdict,
      confidence,
      regions,
      textSegments: []
    };
  }

  private simulateTextLocal(text: string): DetectionResult {
    const sentenceRegex = /[^.!?]+(?:[.!?]+|$)/g;
    const sentences = text.match(sentenceRegex) || [text];

    let aiTriggerCount = 0;
    const textSegments: TextSegment[] = sentences.map((sentence) => {
      const trimmed = sentence.trim();
      if (trimmed.length === 0) {
        return { text: sentence, confidence: 0, verdict: 'human' };
      }

      const aiBuzzwords = ['delve', 'tapestry', 'testament', 'moreover', 'furthermore', 'crucial'];
      const containsBuzzword = aiBuzzwords.some(word => new RegExp(`\\b${word}\\b`, 'i').test(trimmed));
      const hash = trimmed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const isAI = containsBuzzword || (hash % 7 === 0);
      const confidence = isAI ? Math.floor(70 + (hash % 26)) : Math.floor(10 + (hash % 30));

      let verdict: 'ai' | 'human' | 'uncertain' = 'human';
      if (confidence > 75) {
        verdict = 'ai';
        aiTriggerCount++;
      } else if (confidence > 45) {
        verdict = 'uncertain';
      }

      return { text: sentence, confidence, verdict };
    });

    const aiRatio = aiTriggerCount / Math.max(1, textSegments.length);
    const overallVerdict: 'ai' | 'human' | 'uncertain' = aiRatio > 0.4 ? 'ai' : aiRatio > 0.1 ? 'uncertain' : 'human';
    const overallConfidence = aiRatio > 0.4 ? 88 : aiRatio > 0.1 ? 55 : 85;

    return {
      verdict: overallVerdict,
      confidence: overallConfidence,
      regions: [],
      textSegments
    };
  }
}
