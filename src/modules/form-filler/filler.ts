import type { ApplicationPendingField } from '../executor/types';
import type { FieldFillStatus, FormField } from '../form-parser/types';
import type { FieldResolution, ResolveContext } from './resolver';
import { resolveField } from './resolver';

export interface FillOutcome {
  field: FormField;
  resolution: FieldResolution;
  fillStatus: FieldFillStatus;
  error?: string;
}

export interface FillReport {
  outcomes: FillOutcome[];
  filled: FormField[];
  pendings: ApplicationPendingField[];
}

export interface FillFieldsOptions extends ResolveContext {
  now?: () => string;
}

function findElement(root: ParentNode, field: FormField): Element | null {
  if (field.selector) {
    try {
      const match = root.querySelector(field.selector);
      if (match) return match;
    } catch {
      // fallthrough
    }
  }
  if (field.id) {
    const byId = (root as Document).getElementById?.(field.id) ?? null;
    if (byId) return byId;
  }
  if (field.name) {
    const byName = root.querySelector(`[name="${CSS.escape(field.name)}"]`);
    if (byName) return byName;
  }
  return null;
}

function dispatchFieldEvents(target: EventTarget): void {
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
}

function fillTextLike(element: Element, value: string): void {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    element.value = value;
    dispatchFieldEvents(element);
    return;
  }
  throw new Error('Elemento incompatível com preenchimento de texto.');
}

function fillSelect(element: Element, value: string): void {
  if (!(element instanceof HTMLSelectElement)) {
    throw new Error('Elemento select inválido.');
  }
  element.value = value;
  dispatchFieldEvents(element);
}

function fillRadioGroup(root: ParentNode, field: FormField, value: string): void {
  const name = field.name;
  const inputs = name
    ? (Array.from(
        root.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`),
      ) as HTMLInputElement[])
    : [];
  if (inputs.length === 0) throw new Error('Grupo de radio não encontrado.');
  const target = inputs.find((input) => input.value === value);
  if (!target) throw new Error(`Opção "${value}" não encontrada no radio group.`);
  target.checked = true;
  dispatchFieldEvents(target);
}

function fillCheckboxGroup(root: ParentNode, field: FormField, value: string): void {
  const name = field.name;
  if (!name) {
    throw new Error('Checkbox sem name não pode ser preenchido em grupo.');
  }
  const inputs = Array.from(
    root.querySelectorAll(`input[type="checkbox"][name="${CSS.escape(name)}"]`),
  ) as HTMLInputElement[];
  if (inputs.length === 0) throw new Error('Grupo de checkbox não encontrado.');
  const values = new Set(value.split(',').map((v) => v.trim()).filter(Boolean));
  for (const input of inputs) {
    const shouldCheck = values.has(input.value);
    if (input.checked !== shouldCheck) {
      input.checked = shouldCheck;
      dispatchFieldEvents(input);
    }
  }
}

function fillStandaloneCheckbox(element: Element, value: string): void {
  if (!(element instanceof HTMLInputElement) || element.type !== 'checkbox') {
    throw new Error('Checkbox inválido.');
  }
  const truthy = ['true', '1', 'yes', 'sim', 'on', element.value].includes(value.toLowerCase());
  element.checked = truthy;
  dispatchFieldEvents(element);
}

function dataUrlToFile(dataUrl: string, fileName: string, mimeType: string): File {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error('Data URL inválida para upload.');
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: mimeType || match[1] });
}

function fillFileInput(element: Element, file: File): void {
  if (!(element instanceof HTMLInputElement) || element.type !== 'file') {
    throw new Error('Input de arquivo inválido.');
  }
  if (typeof DataTransfer === 'undefined') {
    throw new Error('Ambiente não suporta DataTransfer para file input.');
  }
  const dt = new DataTransfer();
  dt.items.add(file);
  element.files = dt.files;
  dispatchFieldEvents(element);
}

export function fillField(
  root: ParentNode,
  field: FormField,
  resolution: FieldResolution,
  options: { resumeFileName?: string; resumeMimeType?: string } = {},
): FillOutcome {
  if (resolution.status !== 'resolved' || resolution.value === undefined) {
    return {
      field,
      resolution,
      fillStatus: resolution.status === 'pending' ? 'pending' : 'skipped',
    };
  }

  const element = findElement(root, field);
  if (!element) {
    return {
      field,
      resolution,
      fillStatus: 'failed',
      error: 'Elemento não encontrado no DOM.',
    };
  }

  try {
    switch (field.type) {
      case 'text':
      case 'textarea':
        fillTextLike(element, resolution.value);
        break;
      case 'select':
        fillSelect(element, resolution.value);
        break;
      case 'radio':
        fillRadioGroup(root, field, resolution.value);
        break;
      case 'checkbox':
        if (field.options.length > 0) {
          fillCheckboxGroup(root, field, resolution.value);
        } else {
          fillStandaloneCheckbox(element, resolution.value);
        }
        break;
      case 'file': {
        if (!resolution.useResume) {
          throw new Error('Resolução de arquivo sem currículo.');
        }
        const file = dataUrlToFile(
          resolution.value,
          options.resumeFileName ?? 'resume.pdf',
          options.resumeMimeType ?? 'application/pdf',
        );
        fillFileInput(element, file);
        break;
      }
      default:
        throw new Error(`Tipo de campo não suportado: ${field.type}`);
    }
    return { field, resolution, fillStatus: 'filled' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { field, resolution, fillStatus: 'failed', error: message };
  }
}

export function fillFields(
  root: ParentNode,
  fields: FormField[],
  options: FillFieldsOptions = {},
): FillReport {
  const { profile, savedAnswers, now = () => new Date().toISOString() } = options;
  const outcomes: FillOutcome[] = [];
  const filled: FormField[] = [];
  const pendings: ApplicationPendingField[] = [];

  for (const field of fields) {
    const resolution = resolveField(field, { profile, savedAnswers });
    const resumeOptions = profile?.resume
      ? { resumeFileName: profile.resume.fileName, resumeMimeType: profile.resume.mimeType }
      : undefined;
    const outcome = fillField(root, field, resolution, resumeOptions);
    outcomes.push(outcome);

    const mutated: FormField = { ...field, fillStatus: outcome.fillStatus };
    if (resolution.confidence) mutated.confidence = resolution.confidence;
    if (resolution.value !== undefined && outcome.fillStatus === 'filled') {
      mutated.value = resolution.value;
    }

    if (outcome.fillStatus === 'filled') {
      filled.push(mutated);
      continue;
    }

    if (outcome.fillStatus === 'pending' || (outcome.fillStatus === 'failed' && field.required)) {
      pendings.push({
        field: mutated,
        reason:
          outcome.error ??
          resolution.pendingReason ??
          'Campo obrigatório sem correspondência automática.',
        createdAt: now(),
      });
    }
  }

  return { outcomes, filled, pendings };
}
