export interface GcpCredentialsValidation {
  valid: boolean;
  projectId: string | null;
  clientEmail: string | null;
  missingFields: string[];
  warnings?: string[];
  error?: string;
}

function friendlyJsonError(raw: string, rawMessage: string): string {
  // Detect the common "trailing comma before closing brace" mistake
  const trimmed = raw.trim();
  const withoutTrailingComma = trimmed.replace(/,\s*}\s*$/m, '}');
  if (withoutTrailingComma !== trimmed) {
    try {
      JSON.parse(withoutTrailingComma);
      return 'Your JSON has a trailing comma (the comma right before the closing }) — remove it and it will be valid.';
    } catch {
      // fall through to generic message below
    }
  }

  // Extract "at position N (line L column C)" and make it human-friendly
  const posMatch = rawMessage.match(/position (\d+)/);
  const lineColMatch = rawMessage.match(/line (\d+) column (\d+)/);
  if (lineColMatch) {
    const [, line, col] = lineColMatch;
    return `Your text is not valid JSON — the parser stopped at line ${line}, column ${col}. This usually means a missing comma between fields, a trailing comma, or an unquoted key like ` + '"type" (keys must be wrapped in double quotes).';
  }
  if (posMatch) {
    return `Your text is not valid JSON (error near position ${posMatch[1]}). This usually means a missing comma between fields, a trailing comma, or an unquoted key like ` + '"type" (keys must be wrapped in double quotes).';
  }
  return `Your text is not valid JSON: ${rawMessage}`;
}

/**
 * Pure, side-effect-free validation of a pasted service-account JSON string.
 * Reports exactly which required fields are missing so users get actionable
 * feedback instead of a cryptic Google auth error.
 *
 * Only `client_email` and `private_key` are truly required for authentication
 * (the Google auth library can default `token_uri`). Everything else that a
 * real console-downloaded key contains is treated as optional.
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
      error: friendlyJsonError(jsonContent, err instanceof Error ? err.message : String(err)),
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
  const warnings: string[] = [];
  if (obj.type !== 'service_account') missingFields.push('type (must be "service_account")');
  if (!obj.project_id) missingFields.push('project_id');
  if (!obj.client_email) missingFields.push('client_email');
  if (!obj.private_key) missingFields.push('private_key');
  if (!obj.token_uri) {
    warnings.push('token_uri is missing — Google will use the default https://oauth2.googleapis.com/token');
  }

  if (missingFields.length > 0) {
    return {
      valid: false,
      projectId: typeof obj.project_id === 'string' ? obj.project_id : null,
      clientEmail: typeof obj.client_email === 'string' ? obj.client_email : null,
      missingFields,
      warnings: warnings.length > 0 ? warnings : undefined,
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
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
