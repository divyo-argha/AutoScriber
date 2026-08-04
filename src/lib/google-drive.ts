const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
}

export async function initGoogleAuth(): Promise<any> {
  return new Promise((resolve) => {
    if (!window.gapi) {
      resolve(null);
      return;
    }

    window.gapi.load('auth2', () => {
      try {
        const auth = window.gapi.auth2.init({
          client_id: GOOGLE_CLIENT_ID,
          scope: GOOGLE_SCOPES.join(' '),
        });
        resolve(auth);
      } catch {
        resolve(null);
      }
    });
  });
}

export async function signInWithGoogle(): Promise<any> {
  const auth = await initGoogleAuth();
  if (!auth) return null;

  try {
    const user = await auth.signIn();
    return user;
  } catch {
    return null;
  }
}

/** The Google Drive REST API requires an OAuth access_token, not the OpenID id_token. */
function getDriveAccessToken(): string | null {
  try {
    return (
      window.gapi?.auth2?.getAuthInstance()?.currentUser.get().getAuthResponse().access_token ||
      window.gapi?.auth2?.getAuthInstance()?.currentUser.get().getAuthResponse(true).access_token ||
      null
    );
  } catch {
    return null;
  }
}

export async function listDriveAudioFiles(folderId: string = 'root'): Promise<GoogleDriveFile[]> {
  const token = getDriveAccessToken();
  if (!token) return [];

  const audioMimes = [
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac',
    'audio/mp4', 'audio/webm', 'audio/aac', 'audio/wma',
  ];
  const mimeQuery = audioMimes.map(m => `mimeType='${m}'`).join(' or ');

  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and (${mimeQuery})&fields=files(id,name,mimeType,size)&pageSize=1000`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    return data.files || [];
  } catch {
    return [];
  }
}

export async function downloadDriveFile(fileId: string, fileName: string): Promise<File | null> {
  const token = getDriveAccessToken();
  if (!token) return null;

  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const blob = await res.blob();
    return new File([blob], fileName, { type: blob.type });
  } catch {
    return null;
  }
}

declare global {
  interface Window {
    gapi: any;
  }
}
