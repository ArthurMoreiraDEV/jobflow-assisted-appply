import type { FormFieldType } from '../form-parser/types';

export const REUSE_MODES = ['suggest', 'auto', 'confirm'] as const;
export type ReuseMode = (typeof REUSE_MODES)[number];

export interface SavedAnswer {
  id: string;
  label: string;
  value: string;
  reuseMode: ReuseMode;
  fieldTypes: FormFieldType[];
  keywords: string[];
  createdAt: string;
  updatedAt: string;
  useCount: number;
}

export function createSavedAnswer(
  overrides: Partial<SavedAnswer> & Pick<SavedAnswer, 'id' | 'label' | 'value'>,
): SavedAnswer {
  const now = new Date(0).toISOString();
  return {
    reuseMode: 'suggest',
    fieldTypes: [],
    keywords: [],
    createdAt: now,
    updatedAt: now,
    useCount: 0,
    ...overrides,
  };
}
