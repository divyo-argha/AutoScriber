export interface GcpCredentialsValidation {
  valid: boolean;
  projectId: string | null;
  clientEmail: string | null;
  missingFields: string[];
  error?: string;
}

/**
 * Pure, side-effect-free validation of a pasted service-account JSON string.
 * Reports exactly which required fields are missing so users get actionable
 * feedback instead of a cryptic Google auth error.
 *
 * Safe to import from client components.
 */
export function validateGcpCredentialsJson(jsonContent: string): GcpCredentialsValidation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonContent);
  } catch (err: unknown) {
    return {
      valid: false,
      projectId: null,
      clientEmail: null,
      missingFields: [],
      error: `The pasted text is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      valid: false,
      projectId: null,
      clientEmail: null,
      missingFields: [],
      error: 'The pasted content must be a JSON object, e.g. the full contents of your service account key file.',
    };
  }

  const obj = parsed as Record<string, unknown>;
  const missingFields: string[] = [];
  if (obj.type !== 'service_account') missingFields.push('type (must be "service_account")');
  if (!obj.project_id) missingFields.push('project_id');
  if (!obj.client_email) missingFields.push('client_email');
  if (!obj.private_key) missingFields.push('private_key');
  if (!obj.token_uri) missingFields.push('token_uri');

  if (missingFields.length > 0) {
    return {
      valid: false,
      projectId: typeof obj.project_id === 'string' ? obj.project_id : null,
      clientEmail: typeof obj.client_email === 'string' ? obj.client_email : null,
      missingFields,
      error:
        `This is not a complete Google service account key file. Missing required field(s): ${missingFields.join(', ')}. ` +
        'Download the full JSON key from Google Cloud Console → IAM & Admin → Service Accounts → your account → Keys → Add Key → Create new key → JSON, then paste its entire contents here.',
    };
  }

  return {
    valid: true,
    projectId: typeof obj.project_id === 'string' ? obj.project_id : null,
    clientEmail: typeof obj.client_email === 'string' ? obj.client_email : null,
    missingFields: [],
  };
}
