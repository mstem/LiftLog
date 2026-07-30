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
    // On Android the Storage Access Framework picker *is* the export: the user
    // chooses where the file lands (Files/Downloads/Drive) and it is written
    // there. Dismissing that picker means "cancel", so we stop - chaining the
    // share sheet onto it made one export ask twice.
    if (Platform.OS === 'android') {
      await saveWithStorageAccessFramework(filename, bytes, contentType);
      return;
    }

    await shareFromCache(filename, bytes, contentType);
  }
}

async function saveWithStorageAccessFramework(
  filename: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const permissions =
    await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted) {
    return;
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
