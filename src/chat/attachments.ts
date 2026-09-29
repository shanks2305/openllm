import RNFS from 'react-native-fs';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
} from '@react-native-documents/picker';

import { extractPdfText, pickPhotos, prepareImage } from '../media/media';
import {
  fileExtension,
  isImageFile,
  isReadableDocument,
  normalizeDocumentText,
} from './documents';
import { createId } from './ids';
import type { Attachment, DocumentAttachment, ImageAttachment } from './types';

// Upper bound on what is stored per file. What reaches the model is trimmed
// further to fit the context size when the prompt is built.
export const MAX_STORED_DOCUMENT_CHARS = 120_000;
export const MAX_ATTACHMENTS = 4;

function stripFileScheme(uri: string) {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

function isCancel(error: unknown) {
  return isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED;
}

async function copyPicked(files: { uri: string; name: string | null }[]) {
  const [first, ...rest] = files.map(file => ({
    uri: file.uri,
    fileName: file.name ?? 'file',
  }));
  const copies = await keepLocalCopy({
    files: [first, ...rest],
    destination: 'cachesDirectory',
  });

  return copies.map((copy, index) => {
    if (copy.status !== 'success') {
      throw new Error(copy.copyError || 'Could not read that file');
    }

    return {
      path: stripFileScheme(copy.localUri),
      name: files[index].name ?? 'file',
    };
  });
}

async function readDocument(
  path: string,
  name: string,
): Promise<DocumentAttachment> {
  const pdf = fileExtension(name) === 'pdf';
  const raw = pdf
    ? (await extractPdfText(path)).text
    : await RNFS.readFile(path, 'utf8');
  const text = normalizeDocumentText(raw);

  if (!text) {
    throw new Error(
      pdf
        ? `${name} has no selectable text. Scanned PDFs are not supported.`
        : `${name} is empty.`,
    );
  }

  return {
    id: createId(),
    kind: 'document',
    name,
    text: text.slice(0, MAX_STORED_DOCUMENT_CHARS),
    ...(text.length > MAX_STORED_DOCUMENT_CHARS ? { truncated: true } : {}),
  };
}

export const attachmentDir = () => `${RNFS.DocumentDirectoryPath}/attachments`;

async function readImage(path: string, name: string): Promise<ImageAttachment> {
  await RNFS.mkdir(attachmentDir());
  const id = createId();
  const prepared = await prepareImage(path, `${attachmentDir()}/${id}.jpg`);
  return { id, kind: 'image', name, path: prepared.path };
}

// Files can be documents or images. Returns null when the user closes the
// picker.
export async function pickFiles(
  limit = MAX_ATTACHMENTS,
): Promise<Attachment[] | null> {
  let picked;

  try {
    picked = await pick({ allowMultiSelection: true, type: ['public.item'] });
  } catch (error) {
    if (isCancel(error)) {
      return null;
    }

    throw error;
  }

  const files = picked.slice(0, limit);

  if (files.length === 0) {
    return null;
  }

  const unsupported = files.filter(file => {
    const name = file.name ?? '';
    return !isReadableDocument(name) && !isImageFile(name);
  });

  if (unsupported.length > 0) {
    throw new Error(
      `Can't read ${unsupported
        .map(file => file.name)
        .join(', ')}. Attach images, PDFs, or text files such as .txt, .md, .csv, .json, or source code.`,
    );
  }

  const copies = await copyPicked(files);

  try {
    return await Promise.all(
      copies.map(copy =>
        isImageFile(copy.name)
          ? readImage(copy.path, copy.name)
          : readDocument(copy.path, copy.name),
      ),
    );
  } finally {
    copies.forEach(copy => RNFS.unlink(copy.path).catch(() => undefined));
  }
}

export async function pickImages(
  limit = MAX_ATTACHMENTS,
): Promise<ImageAttachment[] | null> {
  const photos = await pickPhotos(limit, attachmentDir());

  if (photos.length === 0) {
    return null;
  }

  return photos.map(photo => ({
    id: photo.id,
    kind: 'image',
    name: photo.name,
    path: photo.path,
  }));
}

export function discardAttachments(attachments: Attachment[]) {
  for (const attachment of attachments) {
    if (attachment.kind === 'image') {
      RNFS.unlink(attachment.path).catch(() => undefined);
    }
  }
}
