import fs from 'fs';
import path from 'path';
import { validateGcpCredentialsJson } from './credentials-validate';
import type { GcpCredentialsValidation } from './credentials-validate';

export { validateGcpCredentialsJson };
export type { GcpCredentialsValidation };

export interface GcpCredentialsInfo {
  exists: boolean;
  filePath: string | null;
  projectId: string | null;
  clientEmail: string | null;
  location: string;
  source: 'root_file' | 'env_var' | 'data_dir' | 'custom_path' | 'none';
  error?: string;
}

/**
 * Searches for gcp-credentials.json across default location candidates.
 */
export function findGcpCredentialsPath(customPath?: string | null): { path: string; source: GcpCredentialsInfo['source'] } | null {
  const cwd = process.cwd();

  // 1. Explicit custom path if provided & exists
  if (customPath && customPath.trim().length > 0) {
    const resolvedCustom = path.isAbsolute(customPath) ? customPath : path.join(cwd, customPath);
    if (fs.existsSync(resolvedCustom)) {
      return { path: resolvedCustom, source: 'custom_path' };
    }
  }

  // 2. Root directory: gcp-credentials.json
  const rootPath = path.join(cwd, 'gcp-credentials.json');
  if (fs.existsSync(rootPath)) {
    return { path: rootPath, source: 'root_file' };
  }

  // 3. Environment variable GOOGLE_APPLICATION_CREDENTIALS
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const envPath = path.isAbsolute(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      ? process.env.GOOGLE_APPLICATION_CREDENTIALS
      : path.join(cwd, process.env.GOOGLE_APPLICATION_CREDENTIALS);
    if (fs.existsSync(envPath)) {
      return { path: envPath, source: 'env_var' };
    }
  }

  // 4. Data directory: data/gcp-credentials.json
  const dataPath = path.join(cwd, 'data', 'gcp-credentials.json');
  if (fs.existsSync(dataPath)) {
    return { path: dataPath, source: 'data_dir' };
  }

  return null;
}

/**
 * Parses and returns metadata about the detected GCP credentials file.
 */
export function getGcpCredentialsInfo(customPath?: string | null, customLocation?: string | null): GcpCredentialsInfo {
  const defaultLocation = customLocation || process.env.GCP_LOCATION || process.env.GOOGLE_CLOUD_REGION || 'us-central1';
  const found = findGcpCredentialsPath(customPath);

  if (!found) {
    return {
      exists: false,
      filePath: null,
      projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || null,
      clientEmail: null,
      location: defaultLocation,
      source: 'none',
    };
  }

  try {
    const fileContent = fs.readFileSync(found.path, 'utf8');
    const json = JSON.parse(fileContent);

    const projectId = json.project_id || process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || null;
    const clientEmail = json.client_email || null;

    if (!projectId && !json.private_key) {
      return {
        exists: true,
        filePath: found.path,
        projectId: null,
        clientEmail: null,
        location: defaultLocation,
        source: found.source,
        error: 'JSON file found but missing required fields "project_id" or "private_key".',
      };
    }

    return {
      exists: true,
      filePath: found.path,
      projectId,
      clientEmail,
      location: defaultLocation,
      source: found.source,
    };
  } catch (err: any) {
    return {
      exists: true,
      filePath: found.path,
      projectId: null,
      clientEmail: null,
      location: defaultLocation,
      source: found.source,
      error: `Invalid GCP service account JSON file: ${err?.message || String(err)}`,
    };
  }
}

/**
 * Saves JSON string content directly to data/gcp-credentials.json or root gcp-credentials.json.
 */
export function saveGcpCredentialsJson(jsonContent: string, saveToRoot = false): { success: boolean; filePath: string; projectId: string | null; error?: string } {
  try {
    const validation = validateGcpCredentialsJson(jsonContent);
    if (!validation.valid) {
      return { success: false, filePath: '', projectId: null, error: validation.error };
    }

    const parsed = JSON.parse(jsonContent);
    const projectId = parsed.project_id || null;
    const cwd = process.cwd();
    const targetDir = saveToRoot ? cwd : path.join(cwd, 'data');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetPath = path.join(targetDir, 'gcp-credentials.json');
    fs.writeFileSync(targetPath, JSON.stringify(parsed, null, 2), 'utf8');

    return {
      success: true,
      filePath: targetPath,
      projectId,
    };
  } catch (err: any) {
    return {
      success: false,
      filePath: '',
      projectId: null,
      error: `Failed to parse JSON credentials: ${err?.message || String(err)}`,
    };
  }
}
