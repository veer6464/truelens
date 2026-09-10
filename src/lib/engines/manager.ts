import { DetectionEngine } from './types';
import { ApiDetectionEngine } from './api-engine';
import { LocalDetectionEngine } from './local-engine';
import { getAppConfig } from '../config';

// Re-use singletons
const apiEngine = new ApiDetectionEngine();
const localEngine = new LocalDetectionEngine();

export function getEngine(type: 'text' | 'image'): DetectionEngine {
  const config = getAppConfig();
  if (type === 'text') {
    return config.textEngine === 'local' ? localEngine : apiEngine;
  } else {
    return config.imageEngine === 'local' ? localEngine : apiEngine;
  }
}
