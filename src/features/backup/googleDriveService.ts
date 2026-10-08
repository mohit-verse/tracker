import * as AuthSession from 'expo-auth-session';
import { BackupDocument } from '../../types';

// ============================================================================
// CONFIGURATION LIMITATION
// ============================================================================
// Google Drive integration requires an OAuth 2.0 Client ID from Google Cloud Console.
// We DO NOT invent values here as per specifications.
// To fully enable this feature:
// 1. Create an OAuth client ID for iOS, Android, and Web in Google Cloud Console.
// 2. Add the client IDs below.
// 3. Ensure the 'https://www.googleapis.com/auth/drive.appdata' scope is enabled.
// ============================================================================
const GOOGLE_CLIENT_ID_IOS = undefined; // 'YOUR_IOS_CLIENT_ID';
const GOOGLE_CLIENT_ID_ANDROID = undefined; // 'YOUR_ANDROID_CLIENT_ID';
const GOOGLE_CLIENT_ID_EXPO = undefined; // 'YOUR_EXPO_CLIENT_ID';

const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const DRIVE_METADATA_URL = 'https://www.googleapis.com/drive/v3/files';
const BACKUP_FILE_NAME = 'tracker_backup.json';

// Utility to throw configuration error
const ensureConfigured = () => {
  if (!GOOGLE_CLIENT_ID_IOS && !GOOGLE_CLIENT_ID_ANDROID && !GOOGLE_CLIENT_ID_EXPO) {
    throw new Error(
      'Google Drive is not fully configured. An OAuth Client ID is required in googleDriveService.ts.'
    );
  }
};

/**
 * Uploads a Tracker backup to the hidden Google Drive AppData folder.
 */
export const uploadToGoogleDrive = async (
  accessToken: string,
  backup: BackupDocument
): Promise<void> => {
  ensureConfigured();

  const boundary = 'foo_bar_baz';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: BACKUP_FILE_NAME,
    mimeType: 'application/json',
    parents: ['appDataFolder'], // Use least-privilege AppData folder
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(backup) +
    closeDelimiter;

  // 1. Check if backup already exists
  const existingFileId = await getExistingBackupId(accessToken);
  const method = existingFileId ? 'PATCH' : 'POST';
  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : DRIVE_UPLOAD_URL;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!response.ok) {
    throw new Error('Upload to Google Drive failed.');
  }
};

/**
 * Downloads the Tracker backup from Google Drive.
 */
export const downloadFromGoogleDrive = async (accessToken: string): Promise<unknown> => {
  ensureConfigured();

  const fileId = await getExistingBackupId(accessToken);
  if (!fileId) {
    throw new Error('No Tracker backup found in Google Drive.');
  }

  const response = await fetch(`${DRIVE_METADATA_URL}/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Download from Google Drive failed.');
  }

  try {
    return await response.json();
  } catch {
    throw new Error('Corrupted backup data in Google Drive.');
  }
};

/**
 * Helper to locate an existing backup in the AppData folder.
 */
const getExistingBackupId = async (accessToken: string): Promise<string | null> => {
  const query = encodeURIComponent(`name = '${BACKUP_FILE_NAME}'`);
  const response = await fetch(
    `${DRIVE_METADATA_URL}?spaces=appDataFolder&q=${query}&fields=files(id,name)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to query Google Drive.');
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
};
