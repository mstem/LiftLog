import { File, Paths } from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { shareAsync } from 'expo-sharing';
import { Platform } from 'react-native';

export class FileExportService {
  async exportBytes(
    filename: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<void> {
    // On Android, use the Storage Access Framework so the user gets a real
    // document picker (Files/Downloads/Drive) and chooses where the file lands.
    // If they decline the folder prompt we fall back to the share sheet.
    if (Platform.OS === 'android') {
      const saved = await saveWithStorageAccessFramework(
        filename,
        bytes,
        contentType,
      );
      if (saved) {
        return;
      }
    }

    await shareFromCache(filename, bytes, contentType);
  }
}

async function saveWithStorageAccessFramework(
  filename: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<boolean> {
  const permissions =
    await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted) {
    return false;
  }

  // Our filenames already carry the correct extension (.sqlite.gz/.csv/.json)
  // matching the mime type, so SAF keeps them as-is with no double extension.
  const targetUri = await StorageAccessFramework.createFileAsync(
    permissions.directoryUri,
    filename,
    contentType,
  );
  await StorageAccessFramework.writeAsStringAsync(
    targetUri,
    Buffer.from(bytes).toString('base64'),
    { encoding: 'base64' },
  );
  return true;
}

async function shareFromCache(
  filename: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const file = new File(Paths.join(Paths.cache, filename));
  if (file.exists) {
    file.delete();
  }
  file.create();
  const stream = file.writableStream();
  const writer = stream.getWriter();
  await writer.write(bytes);
  await writer.close();
  await shareAsync(file.uri, {
    dialogTitle: 'Export data',
    mimeType: contentType,
  });
}
