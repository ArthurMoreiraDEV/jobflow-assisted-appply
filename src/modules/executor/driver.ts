export type AdvanceKind = 'advanced' | 'submitted' | 'blocked';

export interface AdvanceOutcome {
  kind: AdvanceKind;
  message?: string;
}

export interface PageDriver {
  open?(url: string): Promise<void>;
  getRoot(): ParentNode;
  advance(): Promise<AdvanceOutcome>;
  close?(): Promise<void>;
}

export interface DocumentDriverOptions {
  root: ParentNode | (() => ParentNode);
  nextSelector?: string;
  submitSelector?: string;
  errorSelector?: string;
}

const DEFAULT_NEXT = 'button[data-easy-apply-next], button[aria-label*="Avançar"], button[aria-label*="Next"]';
const DEFAULT_SUBMIT = 'button[data-easy-apply-submit], button[aria-label*="Enviar candidatura"], button[aria-label*="Submit application"]';
const DEFAULT_ERROR = '[role="alert"], .artdeco-inline-feedback--error';

export function createDocumentDriver(options: DocumentDriverOptions): PageDriver {
  const rootOption = options.root;
  const getRoot: () => ParentNode =
    typeof rootOption === 'function' ? rootOption : () => rootOption;
  const nextSelector = options.nextSelector ?? DEFAULT_NEXT;
  const submitSelector = options.submitSelector ?? DEFAULT_SUBMIT;
  const errorSelector = options.errorSelector ?? DEFAULT_ERROR;

  async function advance(): Promise<AdvanceOutcome> {
    const root = getRoot();
    const errorEl = root.querySelector(errorSelector);
    const errorText = errorEl?.textContent?.trim();
    if (errorText) {
      return { kind: 'blocked', message: errorText };
    }

    const submit = root.querySelector(submitSelector);
    if (submit instanceof HTMLElement && !submit.hasAttribute('disabled')) {
      submit.click();
      return { kind: 'submitted' };
    }

    const next = root.querySelector(nextSelector);
    if (next instanceof HTMLElement && !next.hasAttribute('disabled')) {
      next.click();
      return { kind: 'advanced' };
    }

    return { kind: 'blocked', message: 'Nenhum botão de avançar ou enviar disponível.' };
  }

  return {
    getRoot,
    advance,
  };
}
