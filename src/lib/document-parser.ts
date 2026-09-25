import * as _pdf from 'pdf-parse';
import mammoth from 'mammoth';

// @ts-ignore
const pdf = (_pdf.default || _pdf) as any;

export async function parseDocument(buffer: Buffer, mimeType: string): Promise<string> {
  const normalizedMime = mimeType.toLowerCase();

  try {
    if (normalizedMime === 'application/pdf') {
      const data = await pdf(buffer);
      return data.text || '';
    } 
    
    if (
      normalizedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      normalizedMime === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    }
    
    if (normalizedMime.startsWith('text/') || normalizedMime === 'application/octet-stream') {
      return buffer.toString('utf-8');
    }
    
    throw new Error(`Unsupported document mime type: ${mimeType}`);
  } catch (error: any) {
    console.error(`Document parser error for ${mimeType}:`, error);
    throw new Error(`Failed to parse document: ${error.message || 'unknown error'}`);
  }
}

