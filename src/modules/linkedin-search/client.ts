import { isLinkedInJobsUrl } from './urls';
import type { JobListing } from '../job-list';
import {
  LINKEDIN_SEARCH_MESSAGE,
  type LinkedInSearchExtractResponse,
  type LinkedInSearchRequest,
} from './messages';

interface ChromeTab {
  id?: number;
  url?: string;
}

interface ChromeTabsApi {
  query: (query: { active: boolean; currentWindow: boolean }) => Promise<ChromeTab[]>;
  sendMessage: <T>(tabId: number, message: unknown) => Promise<T>;
  create: (info: { url: string; active?: boolean }) => Promise<ChromeTab>;
}

interface ChromeBridge {
  tabs?: ChromeTabsApi;
}

function getChrome(): ChromeBridge | undefined {
  return (globalThis as unknown as { chrome?: ChromeBridge }).chrome;
}

export interface ExtractFromActiveTabResult {
  listings: JobListing[];
  tabUrl: string;
  onLinkedInJobs: boolean;
}

export async function extractFromActiveTab(
  bridge: ChromeBridge | undefined = getChrome(),
): Promise<ExtractFromActiveTabResult> {
  const tabs = bridge?.tabs;
  if (!tabs) {
    throw new Error('API de abas do Chrome indisponível.');
  }
  const [activeTab] = await tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) {
    throw new Error('Nenhuma aba ativa encontrada.');
  }
  const tabUrl = activeTab.url ?? '';
  if (!isLinkedInJobsUrl(tabUrl)) {
    throw new Error('A aba ativa não está na área de vagas do LinkedIn.');
  }
  const request: LinkedInSearchRequest = { type: LINKEDIN_SEARCH_MESSAGE.extract };
  const response = await tabs.sendMessage<LinkedInSearchExtractResponse>(
    activeTab.id,
    request,
  );
  if (!response?.ok) {
    throw new Error(response?.error ?? 'Falha ao extrair vagas da aba.');
  }
  return {
    listings: response.listings,
    tabUrl,
    onLinkedInJobs: true,
  };
}

export async function openLinkedInSearch(
  url: string,
  bridge: ChromeBridge | undefined = getChrome(),
): Promise<void> {
  const tabs = bridge?.tabs;
  if (tabs?.create) {
    await tabs.create({ url, active: true });
    return;
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener');
  }
}
