import fs from 'fs';
import path from 'path';

export interface AppConfig {
  textEngine: 'api' | 'local';
  imageEngine: 'api' | 'local';
}

const CONFIG_PATH = path.join(process.cwd(), 'truelens_config.json');

const DEFAULT_CONFIG: AppConfig = {
  textEngine: 'local',
  imageEngine: 'local',
};

export function getAppConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Failed to read config file, returning defaults:', error);
  }
  return DEFAULT_CONFIG;
}

export function saveAppConfig(config: Partial<AppConfig>): AppConfig {
  const current = getAppConfig();
  const updated = { ...current, ...config };
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save config file:', error);
  }
  return updated;
}
