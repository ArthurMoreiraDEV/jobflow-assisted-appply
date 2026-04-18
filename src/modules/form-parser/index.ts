export const FORM_PARSER_MODULE = 'form-parser';

export type {
  FieldConfidence,
  FieldFillStatus,
  FormField,
  FormFieldOption,
  FormFieldType,
} from './types';
export {
  FIELD_CONFIDENCES,
  FIELD_FILL_STATUSES,
  FORM_FIELD_TYPES,
  createFormField,
} from './types';
export type { ParseFormOptions } from './parser';
export { parseFormFields, parseFormFieldsByStep, detectCurrentStep } from './parser';
