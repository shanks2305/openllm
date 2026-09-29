import { NativeEventEmitter, NativeModules } from 'react-native';

import { modelManager } from '../model/ModelManager';
import { fileExists } from '../model/modelStorage';

const { Llama } = NativeModules;

export async function testLlama() {
  if (!Llama) {
    throw new Error('Llama native module is unavailable');
  }

  const path = await modelManager.getActivePath();

  if (!path || !(await fileExists(path))) {
    throw new Error('No model selected. Add one in Settings → Models.');
  }

  const loadResult = await Llama.loadModel(path, 4096, 512, 128);

  console.log('Load result:', loadResult);

  const info = await Llama.getModelInfo();

  console.log('Model info:', info);

  const emitter = new NativeEventEmitter(Llama);

  const subscription = emitter.addListener('LlamaToken', event => {
    const token = (event as { token: string }).token;

    console.log('TOKEN:', JSON.stringify(token), 'length:', token?.length);
  });

  try {
    const result = await Llama.generate(
      'Hello! Who are you?',
      100,
      0.7,
      0.9,
      1.1,
    );
    console.log('Result:', result);
    return result;
  } finally {
    subscription.remove();
  }
}
