export const FORM_FIELD_TYPES = [
  'text',
  'textarea',
  'select',
  'radio',
  'checkbox',
  'file',
] as const;

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const FIELD_CONFIDENCES = ['high', 'medium', 'low'] as const;
export type FieldConfidence = (typeof FIELD_CONFIDENCES)[number];

export const FIELD_FILL_STATUSES = [
  'pending',
  'filled',
  'skipped',
  'failed',
] as const;
export type FieldFillStatus = (typeof FIELD_FILL_STATUSES)[number];

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  name?: string;
  placeholder?: string;
  required: boolean;
  options: FormFieldOption[];
  value?: string;
  confidence?: FieldConfidence;
  fillStatus: FieldFillStatus;
  step?: number;
  selector?: string;
}

export function createFormField(
  overrides: Partial<FormField> & Pick<FormField, 'id' | 'type' | 'label'>,
): FormField {
  return {
    required: false,
    options: [],
    fillStatus: 'pending',
    ...overrides,
  };
}
