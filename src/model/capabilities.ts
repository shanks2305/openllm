import { getCatalogModel } from './catalog';
import type { InstalledModel } from './types';

// 'toggle': the model thinks by default and obeys /think and /no_think.
// 'always': the model always reasons and has no switch.
export type ReasoningStyle = 'toggle' | 'always' | null;

type ModelLike = Pick<InstalledModel, 'id' | 'name'> &
  Partial<Pick<InstalledModel, 'origin' | 'projectorPath'>>;

function catalogEntry(model: ModelLike) {
  return getCatalogModel(model.origin ?? '') ?? getCatalogModel(model.id);
}

export function reasoningStyle(model: ModelLike | null | undefined): ReasoningStyle {
  if (!model) {
    return null;
  }

  if (catalogEntry(model)?.reasoning) {
    return 'toggle';
  }

  const name = `${model.id} ${model.name} ${model.origin ?? ''}`.toLowerCase();

  if (/qwen-?3(?![.\d]*-?vl)/.test(name) && !/instruct-2507|coder/.test(name)) {
    return 'toggle';
  }

  if (/deepseek-r1|qwq|-r1-|thinking|reason/.test(name)) {
    return 'always';
  }

  return null;
}

export function hasVision(model: ModelLike | null | undefined) {
  return Boolean(model?.projectorPath);
}

export function catalogProjector(model: ModelLike) {
  return catalogEntry(model)?.projector ?? null;
}
