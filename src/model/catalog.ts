import type { CatalogModel } from './types';

export const MODEL_CATALOG: CatalogModel[] = [
  {
    id: 'smollm2-360m-instruct-q8_0',
    name: 'SmolLM2 360M Instruct',
    description: 'Tiny Hugging Face model. Best for older phones and quick tests.',
    quant: 'Q8_0',
    sizeBytes: 386404992,
    url: 'https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF/resolve/main/smollm2-360m-instruct-q8_0.gguf',
  },
  {
    id: 'qwen2.5-0.5b-instruct-q4_k_m',
    name: 'Qwen2.5 0.5B Instruct',
    description: 'Smallest Qwen chat model. Fast starting point for on-device replies.',
    quant: 'Q4_K_M',
    sizeBytes: 491400032,
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
  },
  {
    id: 'tinyllama-1.1b-chat-q4_k_m',
    name: 'TinyLlama 1.1B Chat',
    description: 'Very small Llama-style chat model. Light on RAM and storage.',
    quant: 'Q4_K_M',
    sizeBytes: 668788096,
    url: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
  },
  {
    id: 'gemma-3-1b-it-q4_k_m',
    name: 'Gemma 3 1B Instruct',
    description: 'Google’s 1B instruct model. Good quality in a phone-sized file.',
    quant: 'Q4_K_M',
    sizeBytes: 806058272,
    url: 'https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf',
  },
  {
    id: 'llama-3.2-1b-instruct-q4_k_m',
    name: 'Llama 3.2 1B Instruct',
    description: 'Meta’s compact instruct model. Strong English for its size.',
    quant: 'Q4_K_M',
    sizeBytes: 807694464,
    url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
  },
  {
    id: 'smollm2-1.7b-instruct-q4_k_m',
    name: 'SmolLM2 1.7B Instruct',
    description: 'Built for on-device use. Faster than most 3B models.',
    quant: 'Q4_K_M',
    sizeBytes: 1055609536,
    url: 'https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF/resolve/main/smollm2-1.7b-instruct-q4_k_m.gguf',
  },
  {
    id: 'qwen2.5-1.5b-instruct-q4_k_m',
    name: 'Qwen2.5 1.5B Instruct',
    description: 'Balanced multilingual chat. Reasonable on newer phones.',
    quant: 'Q4_K_M',
    sizeBytes: 1117320736,
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
  },
  {
    id: 'qwen2.5-coder-1.5b-instruct-q4_k_m',
    name: 'Qwen2.5 Coder 1.5B',
    description: 'Same size class as 1.5B chat, tuned for code questions.',
    quant: 'Q4_K_M',
    sizeBytes: 1117320768,
    url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf',
  },
  {
    id: 'gemma-2-2b-it-q4_k_m',
    name: 'Gemma 2 2B Instruct',
    description: 'Stronger replies than 1B-class models. Needs more RAM.',
    quant: 'Q4_K_M',
    sizeBytes: 1708582752,
    url: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
  },
  {
    id: 'llama-3.2-3b-instruct-q4_k_m',
    name: 'Llama 3.2 3B Instruct',
    description: 'Best general Llama in this list. Plan on ~2GB disk and more RAM.',
    quant: 'Q4_K_M',
    sizeBytes: 2019377696,
    url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
  },
  {
    id: 'qwen2.5-3b-instruct-q4_k_m',
    name: 'Qwen2.5 3B Instruct',
    description: 'Highest-quality Qwen here. Best on devices with plenty of storage.',
    quant: 'Q4_K_M',
    sizeBytes: 2104932768,
    url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
  },
];

export function getCatalogModel(id: string): CatalogModel | undefined {
  return MODEL_CATALOG.find(model => model.id === id);
}
