import { NativeModules, Platform, Vibration } from 'react-native';

type LlamaHaptics = {
  impact?: () => void;
};

export function hapticTap() {
  const impact = (NativeModules.Llama as LlamaHaptics | undefined)?.impact;

  if (typeof impact === 'function') {
    impact();
    return;
  }

  if (Platform.OS === 'android') {
    Vibration.vibrate(10);
  }
}
