import { getDownloadURL, ref, uploadBytes, type UploadMetadata } from 'firebase/storage';
import { storage } from '../firebase';
import { projectMediaPath } from './repository-models';

export { projectMediaPath };

/** Storage operations are centralized so UI features never construct paths. */
export async function uploadProjectMedia(
  projectId: string,
  category: 'photos' | 'library',
  filename: string,
  data: Blob | Uint8Array | ArrayBuffer,
  metadata?: UploadMetadata,
): Promise<string> {
  const mediaRef = ref(storage, projectMediaPath(projectId, category, filename));
  await uploadBytes(mediaRef, data, metadata);
  return getDownloadURL(mediaRef);
}

export async function uploadPhasePhoto(projectId: string, filename: string, data: Blob): Promise<string> {
  return uploadProjectMedia(projectId, 'photos', filename, data, { contentType: 'image/jpeg' });
}

export async function uploadLibraryFile(projectId: string, filename: string, file: File): Promise<string> {
  return uploadProjectMedia(projectId, 'library', filename, file, { contentType: file.type || undefined });
}
