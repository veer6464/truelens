export interface DetectionRegion {
  x: number;      // 0-100 percentage
  y: number;      // 0-100 percentage
  width: number;  // 0-100 percentage
  height: number; // 0-100 percentage
  confidence: number;
  label?: string; // Specific localized AI artifact description
}

export interface TextSegment {
  text: string;
  confidence: number;
  verdict: 'ai' | 'human' | 'uncertain';
}

export interface DetectionResult {
  verdict: 'ai' | 'human' | 'uncertain';
  confidence: number; // 0-100
  regions: DetectionRegion[]; // Empty for text or authentic image
  textSegments: TextSegment[]; // Empty for images
  summary?: string; // Forensic explanation of localized artifacts
}

export interface DetectionEngine {
  detectText(text: string): Promise<DetectionResult>;
  detectImage(imageBuffer: Buffer, mimeType: string): Promise<DetectionResult>;
}
