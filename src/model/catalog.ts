import type { CatalogModel, CatalogVariant } from './types';

type Family = {
  family: string;
  name: string;
  description: string;
  defaultQuant: string;
  repo: string;
  files: Array<[quant: string, sizeBytes: number, filename: string]>;
  reasoning?: boolean;
  projector?: [sizeBytes: number, filename: string];
};

const FAMILIES: Family[] = [
  {
    family: 'smollm2-360m-instruct',
    name: 'SmolLM2 360M Instruct',
    description: 'Tiny Hugging Face model. Best for older phones and quick tests.',
    defaultQuant: 'Q8_0',
    repo: 'HuggingFaceTB/SmolLM2-360M-Instruct-GGUF',
    files: [['Q8_0', 386404992, 'smollm2-360m-instruct-q8_0.gguf']],
  },
  {
    family: 'qwen2.5-0.5b-instruct',
    name: 'Qwen2.5 0.5B Instruct',
    description: 'Smallest Qwen chat model. Fast starting point for on-device replies.',
    defaultQuant: 'Q4_K_M',
    repo: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF',
    files: [
      ['Q4_K_M', 491400032, 'qwen2.5-0.5b-instruct-q4_k_m.gguf'],
      ['Q5_K_M', 522186592, 'qwen2.5-0.5b-instruct-q5_k_m.gguf'],
      ['Q8_0', 675710816, 'qwen2.5-0.5b-instruct-q8_0.gguf'],
    ],
  },
  {
    family: 'tinyllama-1.1b-chat',
    name: 'TinyLlama 1.1B Chat',
    description: 'Very small Llama-style chat model. Light on RAM and storage.',
    defaultQuant: 'Q4_K_M',
    repo: 'TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF',
    files: [
      ['Q3_K_M', 550819200, 'tinyllama-1.1b-chat-v1.0.Q3_K_M.gguf'],
      ['Q4_K_M', 668788096, 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf'],
      ['Q5_K_M', 783017344, 'tinyllama-1.1b-chat-v1.0.Q5_K_M.gguf'],
      ['Q8_0', 1170781568, 'tinyllama-1.1b-chat-v1.0.Q8_0.gguf'],
    ],
  },
  {
    family: 'gemma-3-1b-it',
    name: 'Gemma 3 1B Instruct',
    description: 'Google’s 1B instruct model. Good quality in a phone-sized file.',
    defaultQuant: 'Q4_K_M',
    repo: 'unsloth/gemma-3-1b-it-GGUF',
    files: [
      ['Q3_K_M', 722416160, 'gemma-3-1b-it-Q3_K_M.gguf'],
      ['Q4_K_M', 806058272, 'gemma-3-1b-it-Q4_K_M.gguf'],
      ['Q5_K_M', 851345696, 'gemma-3-1b-it-Q5_K_M.gguf'],
      ['Q8_0', 1069306400, 'gemma-3-1b-it-Q8_0.gguf'],
    ],
  },
  {
    family: 'llama-3.2-1b-instruct',
    name: 'Llama 3.2 1B Instruct',
    description: 'Meta’s compact instruct model. Strong English for its size.',
    defaultQuant: 'Q4_K_M',
    repo: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
    files: [
      ['IQ4_XS', 743141504, 'Llama-3.2-1B-Instruct-IQ4_XS.gguf'],
      ['Q4_K_M', 807694464, 'Llama-3.2-1B-Instruct-Q4_K_M.gguf'],
      ['Q5_K_M', 911503488, 'Llama-3.2-1B-Instruct-Q5_K_M.gguf'],
      ['Q8_0', 1321083008, 'Llama-3.2-1B-Instruct-Q8_0.gguf'],
    ],
  },
  {
    family: 'smollm2-1.7b-instruct',
    name: 'SmolLM2 1.7B Instruct',
    description: 'Built for on-device use. Faster than most 3B models.',
    defaultQuant: 'Q4_K_M',
    repo: 'HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF',
    files: [['Q4_K_M', 1055609536, 'smollm2-1.7b-instruct-q4_k_m.gguf']],
  },
  {
    family: 'qwen2.5-1.5b-instruct',
    name: 'Qwen2.5 1.5B Instruct',
    description: 'Balanced multilingual chat. Reasonable on newer phones.',
    defaultQuant: 'Q4_K_M',
    repo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    files: [
      ['Q3_K_M', 924455968, 'qwen2.5-1.5b-instruct-q3_k_m.gguf'],
      ['Q4_K_M', 1117320736, 'qwen2.5-1.5b-instruct-q4_k_m.gguf'],
      ['Q5_K_M', 1285494304, 'qwen2.5-1.5b-instruct-q5_k_m.gguf'],
      ['Q8_0', 1894532128, 'qwen2.5-1.5b-instruct-q8_0.gguf'],
    ],
  },
  {
    family: 'qwen2.5-coder-1.5b-instruct',
    name: 'Qwen2.5 Coder 1.5B',
    description: 'Same size class as 1.5B chat, tuned for code questions.',
    defaultQuant: 'Q4_K_M',
    repo: 'Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF',
    files: [
      ['Q3_K_M', 924456000, 'qwen2.5-coder-1.5b-instruct-q3_k_m.gguf'],
      ['Q4_K_M', 1117320768, 'qwen2.5-coder-1.5b-instruct-q4_k_m.gguf'],
      ['Q5_K_M', 1285494336, 'qwen2.5-coder-1.5b-instruct-q5_k_m.gguf'],
      ['Q8_0', 1894532160, 'qwen2.5-coder-1.5b-instruct-q8_0.gguf'],
    ],
  },
  {
    family: 'gemma-2-2b-it',
    name: 'Gemma 2 2B Instruct',
    description: 'Stronger replies than 1B-class models. Needs more RAM.',
    defaultQuant: 'Q4_K_M',
    repo: 'bartowski/gemma-2-2b-it-GGUF',
    files: [
      ['IQ4_XS', 1566250848, 'gemma-2-2b-it-IQ4_XS.gguf'],
      ['Q4_K_M', 1708582752, 'gemma-2-2b-it-Q4_K_M.gguf'],
      ['Q5_K_M', 1923278688, 'gemma-2-2b-it-Q5_K_M.gguf'],
      ['Q8_0', 2784495456, 'gemma-2-2b-it-Q8_0.gguf'],
    ],
  },
  {
    family: 'llama-3.2-3b-instruct',
    name: 'Llama 3.2 3B Instruct',
    description: 'Best general Llama in this list. Plan on ~2GB disk and more RAM.',
    defaultQuant: 'Q4_K_M',
    repo: 'bartowski/Llama-3.2-3B-Instruct-GGUF',
    files: [
      ['IQ4_XS', 1829110304, 'Llama-3.2-3B-Instruct-IQ4_XS.gguf'],
      ['Q4_K_M', 2019377696, 'Llama-3.2-3B-Instruct-Q4_K_M.gguf'],
      ['Q5_K_M', 2322154016, 'Llama-3.2-3B-Instruct-Q5_K_M.gguf'],
      ['Q8_0', 3421899296, 'Llama-3.2-3B-Instruct-Q8_0.gguf'],
    ],
  },
  {
    family: 'qwen2.5-3b-instruct',
    name: 'Qwen2.5 3B Instruct',
    description: 'Highest-quality Qwen here. Best on devices with plenty of storage.',
    defaultQuant: 'Q4_K_M',
    repo: 'Qwen/Qwen2.5-3B-Instruct-GGUF',
    files: [
      ['Q3_K_M', 1724178848, 'qwen2.5-3b-instruct-q3_k_m.gguf'],
      ['Q4_K_M', 2104932768, 'qwen2.5-3b-instruct-q4_k_m.gguf'],
      ['Q5_K_M', 2438740384, 'qwen2.5-3b-instruct-q5_k_m.gguf'],
      ['Q8_0', 3616088480, 'qwen2.5-3b-instruct-q8_0.gguf'],
    ],
  },
  {
    family: 'qwen3-0.6b',
    name: 'Qwen3 0.6B',
    description: 'Tiny reasoning model. Thinks step by step before answering; turn Think off for quick replies.',
    defaultQuant: 'Q4_K_M',
    repo: 'unsloth/Qwen3-0.6B-GGUF',
    reasoning: true,
    files: [
      ['Q4_K_M', 396705472, 'Qwen3-0.6B-Q4_K_M.gguf'],
      ['Q8_0', 639447744, 'Qwen3-0.6B-Q8_0.gguf'],
    ],
  },
  {
    family: 'qwen3-1.7b',
    name: 'Qwen3 1.7B',
    description: 'Reasoning model with tool use. The best balance for math, logic, and Tools on a phone.',
    defaultQuant: 'Q4_K_M',
    repo: 'unsloth/Qwen3-1.7B-GGUF',
    reasoning: true,
    files: [
      ['Q4_K_M', 1107409472, 'Qwen3-1.7B-Q4_K_M.gguf'],
      ['Q8_0', 1834426944, 'Qwen3-1.7B-Q8_0.gguf'],
    ],
  },
  {
    family: 'qwen3-4b',
    name: 'Qwen3 4B',
    description: 'Strongest reasoning here. Needs a recent iPhone with 8 GB of RAM.',
    defaultQuant: 'Q4_K_M',
    repo: 'unsloth/Qwen3-4B-GGUF',
    reasoning: true,
    files: [['Q4_K_M', 2497281312, 'Qwen3-4B-Q4_K_M.gguf']],
  },
  {
    family: 'smolvlm2-500m',
    name: 'SmolVLM2 500M Vision',
    description: 'Tiny model that can see. Describe photos, read screenshots and signs.',
    defaultQuant: 'Q8_0',
    repo: 'ggml-org/SmolVLM2-500M-Video-Instruct-GGUF',
    projector: [108785184, 'mmproj-SmolVLM2-500M-Video-Instruct-Q8_0.gguf'],
    files: [['Q8_0', 436808704, 'SmolVLM2-500M-Video-Instruct-Q8_0.gguf']],
  },
  {
    family: 'smolvlm2-2.2b',
    name: 'SmolVLM2 2.2B Vision',
    description: 'Better image understanding and chat than the 500M model.',
    defaultQuant: 'Q4_K_M',
    repo: 'ggml-org/SmolVLM2-2.2B-Instruct-GGUF',
    projector: [592523200, 'mmproj-SmolVLM2-2.2B-Instruct-Q8_0.gguf'],
    files: [['Q4_K_M', 1112602656, 'SmolVLM2-2.2B-Instruct-Q4_K_M.gguf']],
  },
  {
    family: 'qwen2.5-vl-3b',
    name: 'Qwen2.5-VL 3B Vision',
    description: 'Best at reading text, charts, and documents in images. Needs plenty of RAM.',
    defaultQuant: 'Q4_K_M',
    repo: 'ggml-org/Qwen2.5-VL-3B-Instruct-GGUF',
    projector: [844757728, 'mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf'],
    files: [['Q4_K_M', 1929901056, 'Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf']],
  },
];

function toCatalogModel(family: Family): CatalogModel {
  const variants: CatalogVariant[] = family.files.map(
    ([quant, sizeBytes, filename]) => ({
      id: `${family.family}-${quant.toLowerCase()}`,
      quant,
      sizeBytes,
      url: `https://huggingface.co/${family.repo}/resolve/main/${filename}`,
    }),
  );
  const primary =
    variants.find(variant => variant.quant === family.defaultQuant) ??
    variants[0];

  return {
    ...primary,
    name: family.name,
    description: family.description,
    variants,
    ...(family.reasoning ? { reasoning: true } : {}),
    ...(family.projector
      ? {
          projector: {
            sizeBytes: family.projector[0],
            url: `https://huggingface.co/${family.repo}/resolve/main/${family.projector[1]}`,
          },
        }
      : {}),
  };
}

export const MODEL_CATALOG: CatalogModel[] = FAMILIES.map(toCatalogModel);

export const QUANT_NOTES: Record<string, string> = {
  Q3_K_M: 'Smallest. Noticeably lower quality.',
  IQ4_XS: 'A little smaller than Q4_K_M with similar quality.',
  Q4_K_M: 'Recommended balance of size and quality.',
  Q5_K_M: 'Slightly better quality, a bit larger.',
  Q8_0: 'Close to full quality. Largest and slowest.',
};

// Resolves a catalog model or any of its quant variants. Non-default variants
// carry the quant in the name so they are distinguishable once installed.
export function getCatalogModel(id: string): CatalogModel | undefined {
  for (const model of MODEL_CATALOG) {
    const variant = model.variants.find(item => item.id === id);

    if (!variant) {
      continue;
    }

    return {
      ...model,
      ...variant,
      name:
        variant.id === model.id ? model.name : `${model.name} ${variant.quant}`,
    };
  }

  return undefined;
}
