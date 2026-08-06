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
  source: 'root_file' | 'env_var' | 'custom_path' | 'settings' | 'none';
  error?: string;
}

/**
 * Searches for gcp-credentials.json across supported file locations.
 * Note: pasted credentials are stored in the app's SQLite database
 * (settings.gcpCredentialsJson), never in a file.
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
 * Builds credential info purely from a stored JSON string (e.g. the one saved
 * in the app's SQLite database). No filesystem access.
 */
export function getGcpCredentialsInfoFromJson(
  jsonString?: string | null,
  customLocation?: string | null
): GcpCredentialsInfo {
  const defaultLocation = customLocation || process.env.GCP_LOCATION || process.env.GOOGLE_CLOUD_REGION || 'us-central1';

  if (!jsonString || !jsonString.trim()) {
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
    const json = JSON.parse(jsonString);
    const projectId = json.project_id || process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || null;
    const clientEmail = json.client_email || null;

    if (!projectId && !json.private_key) {
      return {
        exists: true,
        filePath: null,
        projectId: null,
        clientEmail: null,
        location: defaultLocation,
        source: 'settings',
        error: 'Stored credentials are missing required fields "project_id" or "private_key".',
      };
    }

    return {
      exists: true,
      filePath: null,
      projectId,
      clientEmail,
      location: defaultLocation,
      source: 'settings',
    };
  } catch (err: any) {
    return {
      exists: true,
      filePath: null,
      projectId: null,
      clientEmail: null,
      location: defaultLocation,
      source: 'settings',
      error: `Invalid stored GCP service account JSON: ${err?.message || String(err)}`,
    };
  }
}

/**
 * Validates a pasted JSON string for storing in the database.
 * Returns the raw string when valid, or a descriptive error.
 */
export function validateStoredCredentialsJson(jsonContent: string): { ok: true; json: string } | { ok: false; error: string } {
  const validation = validateGcpCredentialsJson(jsonContent);
  if (!validation.valid) {
    return { ok: false, error: validation.error || 'Invalid service account JSON.' };
  }
  return { ok: true, json: jsonContent };
}
