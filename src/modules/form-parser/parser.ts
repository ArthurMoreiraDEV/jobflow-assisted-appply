import { createFormField, type FormField, type FormFieldOption, type FormFieldType } from './types';

type FieldElement =
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement;

const TEXT_INPUT_TYPES = new Set([
  'text',
  'email',
  'tel',
  'url',
  'number',
  'search',
  'password',
]);

const STEP_CONTAINER_SELECTORS = [
  '[data-form-step]',
  '[data-test-form-step]',
  '[data-step]',
  'fieldset[data-step]',
  '.form-step',
  'section[aria-current="step"]',
];

function normaliseText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function labelFromAriaLabelledBy(el: Element, root: ParentNode): string {
  const ids = el.getAttribute('aria-labelledby');
  if (!ids) return '';
  const doc = (root as Document).ownerDocument ?? (el.ownerDocument ?? null);
  const scope: Document | ParentNode = doc ?? root;
  const pieces: string[] = [];
  for (const id of ids.split(/\s+/).filter(Boolean)) {
    const node = (scope as Document).getElementById?.(id) ?? null;
    const text = normaliseText(node?.textContent);
    if (text) pieces.push(text);
  }
  return pieces.join(' ');
}

function labelFromForAttribute(el: Element, id: string): string {
  const doc = el.ownerDocument;
  if (!doc || !id) return '';
  const label = doc.querySelector(`label[for="${CSS.escape(id)}"]`);
  return normaliseText(label?.textContent);
}

function labelFromAncestorLabel(el: Element): string {
  const label = el.closest('label');
  if (!label) return '';
  const clone = label.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('input, textarea, select').forEach((node) => node.remove());
  return normaliseText(clone.textContent);
}

function labelFromLegend(el: Element): string {
  const fieldset = el.closest('fieldset');
  if (!fieldset) return '';
  const legend = fieldset.querySelector(':scope > legend');
  return normaliseText(legend?.textContent);
}

function resolveLabel(el: Element, root: ParentNode): string {
  const ariaLabel = normaliseText(el.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;

  const labelledBy = labelFromAriaLabelledBy(el, root);
  if (labelledBy) return labelledBy;

  const forLabel = labelFromForAttribute(el, (el as HTMLElement).id ?? '');
  if (forLabel) return forLabel;

  const ancestorLabel = labelFromAncestorLabel(el);
  if (ancestorLabel) return ancestorLabel;

  const legend = labelFromLegend(el);
  if (legend) return legend;

  const placeholder = normaliseText(el.getAttribute('placeholder'));
  if (placeholder) return placeholder;

  const name = normaliseText(el.getAttribute('name'));
  if (name) return name;

  return '';
}

function inferStepFromAttribute(el: Element): number | undefined {
  let node: Element | null = el;
  while (node) {
    const raw =
      node.getAttribute?.('data-form-step') ??
      node.getAttribute?.('data-test-form-step') ??
      node.getAttribute?.('data-step');
    if (raw != null && raw !== '') {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
    node = node.parentElement;
  }
  return undefined;
}

function assignSteps(fields: FormField[], elements: Element[], root: ParentNode): void {
  const explicitSteps = elements.map((el) => inferStepFromAttribute(el));
  const hasExplicit = explicitSteps.some((step) => step !== undefined);

  if (hasExplicit) {
    elements.forEach((_, index) => {
      const step = explicitSteps[index];
      fields[index].step = step ?? 1;
    });
    return;
  }

  const containers = collectStepContainers(root);
  if (containers.length === 0) return;

  elements.forEach((el, index) => {
    for (let i = 0; i < containers.length; i += 1) {
      if (containers[i].contains(el)) {
        fields[index].step = i + 1;
        return;
      }
    }
  });
}

function collectStepContainers(root: ParentNode): Element[] {
  const seen = new Set<Element>();
  const containers: Element[] = [];
  for (const selector of STEP_CONTAINER_SELECTORS) {
    for (const node of Array.from(root.querySelectorAll(selector))) {
      if (!seen.has(node)) {
        seen.add(node);
        containers.push(node);
      }
    }
  }
  return containers;
}

function buildSelector(el: Element): string {
  const id = (el as HTMLElement).id;
  if (id) return `#${CSS.escape(id)}`;
  const name = el.getAttribute('name');
  if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;
  return el.tagName.toLowerCase();
}

function extractSelectOptions(select: HTMLSelectElement): FormFieldOption[] {
  return Array.from(select.options)
    .filter((option) => option.value !== '')
    .map((option) => ({
      value: option.value,
      label: normaliseText(option.textContent) || option.value,
    }));
}

function groupLabel(input: HTMLInputElement, root: ParentNode): string {
  const fieldset = input.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector(':scope > legend');
    const text = normaliseText(legend?.textContent);
    if (text) return text;
  }
  const labelledBy = labelFromAriaLabelledBy(input, root);
  if (labelledBy) return labelledBy;
  const role = input.closest('[role="radiogroup"], [role="group"]');
  if (role) {
    const aria = normaliseText(role.getAttribute('aria-label'));
    if (aria) return aria;
  }
  return '';
}

function idFor(el: Element, fallbackIndex: number): string {
  const htmlId = (el as HTMLElement).id;
  if (htmlId) return htmlId;
  const name = el.getAttribute('name');
  if (name) return `${el.tagName.toLowerCase()}-${name}-${fallbackIndex}`;
  return `${el.tagName.toLowerCase()}-${fallbackIndex}`;
}

interface ParsedField {
  element: FieldElement;
  field: FormField;
}

function parseTextOrTextareaOrSelect(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  root: ParentNode,
  index: number,
): ParsedField | null {
  let type: FormFieldType;
  if (el instanceof HTMLTextAreaElement) {
    type = 'textarea';
  } else if (el instanceof HTMLSelectElement) {
    type = 'select';
  } else if (TEXT_INPUT_TYPES.has(el.type.toLowerCase())) {
    type = 'text';
  } else {
    return null;
  }

  const field = createFormField({
    id: idFor(el, index),
    type,
    label: resolveLabel(el, root),
    name: el.getAttribute('name') ?? undefined,
    placeholder: el.getAttribute('placeholder') ?? undefined,
    required: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true',
    options: el instanceof HTMLSelectElement ? extractSelectOptions(el) : [],
    value: el instanceof HTMLSelectElement ? el.value : (el as HTMLInputElement).value || undefined,
    selector: buildSelector(el),
  });

  return { element: el, field };
}

function parseRadioGroups(root: ParentNode, existing: Set<Element>): ParsedField[] {
  const radios = Array.from(root.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
  const groups = new Map<string, HTMLInputElement[]>();
  for (const radio of radios) {
    const key = radio.name || `__radio_${radio.id || Math.random()}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(radio);
    groups.set(key, bucket);
  }

  const results: ParsedField[] = [];
  let index = 0;
  for (const [key, inputs] of groups.entries()) {
    if (inputs.length === 0) continue;
    const first = inputs[0];
    const label = groupLabel(first, root);
    const options: FormFieldOption[] = inputs.map((input) => ({
      value: input.value || input.id || '',
      label:
        labelFromForAttribute(input, input.id) ||
        labelFromAncestorLabel(input) ||
        normaliseText(input.getAttribute('aria-label')) ||
        input.value,
    }));
    const checked = inputs.find((input) => input.checked);
    const required = inputs.some(
      (input) => input.hasAttribute('required') || input.getAttribute('aria-required') === 'true',
    );
    const field = createFormField({
      id: first.name ? `radio-${first.name}` : idFor(first, index),
      type: 'radio',
      label: label || first.name || '',
      name: first.name || undefined,
      required,
      options,
      value: checked?.value,
      selector: first.name
        ? `input[type="radio"][name="${first.name}"]`
        : buildSelector(first),
    });
    inputs.forEach((input) => existing.add(input));
    results.push({ element: first, field });
    index += 1;
    void key;
  }
  return results;
}

function parseCheckboxes(root: ParentNode, existing: Set<Element>): ParsedField[] {
  const checkboxes = Array.from(
    root.querySelectorAll('input[type="checkbox"]'),
  ) as HTMLInputElement[];
  const groups = new Map<string, HTMLInputElement[]>();
  const standalone: HTMLInputElement[] = [];

  for (const box of checkboxes) {
    if (!box.name) {
      standalone.push(box);
      continue;
    }
    const bucket = groups.get(box.name) ?? [];
    bucket.push(box);
    groups.set(box.name, bucket);
  }

  const results: ParsedField[] = [];
  let index = 0;

  for (const [name, inputs] of groups.entries()) {
    const first = inputs[0];
    if (inputs.length > 1) {
      const options: FormFieldOption[] = inputs.map((input) => ({
        value: input.value || input.id || '',
        label:
          labelFromForAttribute(input, input.id) ||
          labelFromAncestorLabel(input) ||
          normaliseText(input.getAttribute('aria-label')) ||
          input.value,
      }));
      const checked = inputs.filter((input) => input.checked).map((input) => input.value);
      const required = inputs.some(
        (input) => input.hasAttribute('required') || input.getAttribute('aria-required') === 'true',
      );
      const field = createFormField({
        id: `checkbox-${name}`,
        type: 'checkbox',
        label: groupLabel(first, root) || name,
        name,
        required,
        options,
        value: checked.length > 0 ? checked.join(',') : undefined,
        selector: `input[type="checkbox"][name="${name}"]`,
      });
      inputs.forEach((input) => existing.add(input));
      results.push({ element: first, field });
    } else {
      standalone.push(first);
    }
    index += 1;
  }

  for (const box of standalone) {
    const field = createFormField({
      id: idFor(box, index),
      type: 'checkbox',
      label: resolveLabel(box, root),
      name: box.name || undefined,
      required: box.hasAttribute('required') || box.getAttribute('aria-required') === 'true',
      options: [],
      value: box.checked ? box.value || 'on' : undefined,
      selector: buildSelector(box),
    });
    existing.add(box);
    results.push({ element: box, field });
    index += 1;
  }

  return results;
}

function parseFileInputs(root: ParentNode, existing: Set<Element>): ParsedField[] {
  const files = Array.from(root.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
  const results: ParsedField[] = [];
  files.forEach((el, index) => {
    const accept = el.getAttribute('accept') ?? undefined;
    const field = createFormField({
      id: idFor(el, index),
      type: 'file',
      label: resolveLabel(el, root),
      name: el.getAttribute('name') ?? undefined,
      required: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true',
      options: [],
      placeholder: accept,
      selector: buildSelector(el),
    });
    existing.add(el);
    results.push({ element: el, field });
  });
  return results;
}

export interface ParseFormOptions {
  step?: number;
}

export function parseFormFields(root: ParentNode, options: ParseFormOptions = {}): FormField[] {
  const consumed = new Set<Element>();

  const radioFields = parseRadioGroups(root, consumed);
  const checkboxFields = parseCheckboxes(root, consumed);
  const fileFields = parseFileInputs(root, consumed);

  const generic: ParsedField[] = [];
  const genericNodes = Array.from(
    root.querySelectorAll('input, textarea, select'),
  ) as Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

  genericNodes.forEach((el, index) => {
    if (consumed.has(el)) return;
    if (el instanceof HTMLInputElement) {
      const type = el.type.toLowerCase();
      if (!TEXT_INPUT_TYPES.has(type)) return;
    }
    const parsed = parseTextOrTextareaOrSelect(el, root, index);
    if (parsed) generic.push(parsed);
  });

  const all = [...generic, ...radioFields, ...checkboxFields, ...fileFields];
  const fields = all.map((entry) => entry.field);
  const elements = all.map((entry) => entry.element);

  assignSteps(fields, elements, root);

  if (options.step !== undefined) {
    for (const field of fields) {
      if (field.step === undefined) field.step = options.step;
    }
  }

  return fields;
}

export function parseFormFieldsByStep(
  root: ParentNode,
  step: number,
): FormField[] {
  const all = parseFormFields(root);
  if (all.some((field) => field.step !== undefined)) {
    return all.filter((field) => field.step === step);
  }
  return all.map((field) => ({ ...field, step }));
}

export function detectCurrentStep(root: ParentNode): number | undefined {
  const explicit = root.querySelector(
    '[data-current-step], [aria-current="step"], [data-form-step][data-active="true"]',
  );
  if (explicit) {
    const raw =
      explicit.getAttribute('data-current-step') ??
      explicit.getAttribute('data-form-step') ??
      explicit.getAttribute('data-step');
    if (raw != null && raw !== '') {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  const containers = collectStepContainers(root);
  if (containers.length === 0) return undefined;
  return 1;
}
