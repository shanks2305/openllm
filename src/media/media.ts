import { NativeEventEmitter, NativeModules } from 'react-native';

type MediaNativeModule = {
  extractPdfText: (path: string) => Promise<{ text: string; pages: number }>;
  prepareImage: (
    source: string,
    destination: string,
    maxSide: number,
  ) => Promise<{ path: string; width: number; height: number }>;
  pickPhotos: (
    limit: number,
    directory: string,
    maxSide: number,
  ) => Promise<{ id: string; name: string; path: string }[]>;
  speak: (text: string, rate: number) => void;
  stopSpeaking: () => void;
  startListening: () => Promise<boolean>;
  stopListening: () => void;
};

const Media = NativeModules.Media as MediaNativeModule | undefined;
const emitter = Media ? new NativeEventEmitter(NativeModules.Media) : null;

function requireMedia(): MediaNativeModule {
  if (!Media) {
    throw new Error('This feature needs the iOS app to be rebuilt.');
  }

  return Media;
}

export const mediaAvailable = Boolean(Media);

export function extractPdfText(path: string) {
  return requireMedia().extractPdfText(path);
}

export function prepareImage(source: string, destination: string, maxSide = 1024) {
  return requireMedia().prepareImage(source, destination, maxSide);
}

export function pickPhotos(limit: number, directory: string, maxSide = 1024) {
  return requireMedia().pickPhotos(limit, directory, maxSide);
}

// One reply is read aloud at a time; the id says which, so its button can
// show a stop state.
let speakingId: string | null = null;
let speechDone: { remove: () => void } | null = null;
const speechListeners = new Set<() => void>();

function setSpeaking(id: string | null) {
  speakingId = id;
  speechListeners.forEach(listener => listener());
}

export function getSpeakingId() {
  return speakingId;
}

export function subscribeSpeech(listener: () => void) {
  speechListeners.add(listener);
  return () => {
    speechListeners.delete(listener);
  };
}

export function speak(id: string, text: string, rate = 1) {
  const media = requireMedia();

  if (!speechDone && emitter) {
    speechDone = emitter.addListener('MediaSpeechDone', () => setSpeaking(null));
  }

  setSpeaking(id);
  media.speak(text, rate);
}

export function stopSpeaking() {
  Media?.stopSpeaking();
  setSpeaking(null);
}

export type DictationHandlers = {
  onText: (text: string, final: boolean) => void;
  onEnd: (error: string | null) => void;
};

export async function startDictation({ onText, onEnd }: DictationHandlers) {
  const media = requireMedia();
  const transcript = emitter?.addListener(
    'MediaTranscript',
    (event: { text?: string; final?: boolean }) => {
      onText(event.text ?? '', event.final === true);
    },
  );
  const ended = emitter?.addListener(
    'MediaListeningEnded',
    (event: { error?: string | null }) => {
      transcript?.remove();
      ended?.remove();
      onEnd(event.error ?? null);
    },
  );

  try {
    await media.startListening();
  } catch (error) {
    transcript?.remove();
    ended?.remove();
    throw error;
  }

  return () => media.stopListening();
}

// Replies are Markdown. Reading symbols and code aloud is noise, so this keeps
// only the prose.
export function speakableText(markdown: string) {
  return markdown
    .replace(/<think>[\s\S]*?(<\/think>|$)/g, '')
    .replace(/```[\s\S]*?(```|$)/g, ' Code block omitted. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*\|?\s*:?-{2,}.*$/gm, '')
    .replace(/\|/g, ', ')
    .replace(/(\*\*|__|~~|\*|_)(.+?)\1/g, '$2')
    .replace(/\$\$?([^$]+)\$\$?/g, '$1')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
