export const INSTRUCTION_PRESETS = [
  {
    id: 'general',
    label: 'General',
    prompt: '',
  },
  {
    id: 'concise',
    label: 'Concise',
    prompt: 'Answer in a few short sentences.',
  },
  {
    id: 'code',
    label: 'Code',
    prompt:
      'You are a coding assistant. Prefer correct code, and explain only what is needed to use it.',
  },
] as const;

export type InstructionPresetId = (typeof INSTRUCTION_PRESETS)[number]['id'];

export function instructionLabel(prompt?: string) {
  const trimmed = prompt?.trim() ?? '';

  if (!trimmed) {
    return 'General';
  }

  const preset = INSTRUCTION_PRESETS.find(item => item.prompt === trimmed);
  return preset?.label ?? 'Custom';
}
