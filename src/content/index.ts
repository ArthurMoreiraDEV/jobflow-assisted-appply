import {
  extractJobListingsFromDom,
  isLinkedInJobsUrl,
  LINKEDIN_SEARCH_MESSAGE,
  type LinkedInSearchExtractResponse,
  type LinkedInSearchPingResponse,
  type LinkedInSearchRequest,
} from '../modules/linkedin-search';

console.info('[LinkedIn Apply] content script loaded on', window.location.href);

chrome.runtime.onMessage.addListener(
  (
    message: LinkedInSearchRequest,
    _sender,
    sendResponse: (
      response: LinkedInSearchExtractResponse | LinkedInSearchPingResponse,
    ) => void,
  ) => {
    const url = window.location.href;

    if (message?.type === LINKEDIN_SEARCH_MESSAGE.ping) {
      const response: LinkedInSearchPingResponse = {
        ok: true,
        url,
        onLinkedInJobs: isLinkedInJobsUrl(url),
      };
      sendResponse(response);
      return false;
    }

    if (message?.type === LINKEDIN_SEARCH_MESSAGE.extract) {
      try {
        const listings = extractJobListingsFromDom(document);
        const response: LinkedInSearchExtractResponse = {
          ok: true,
          url,
          listings,
        };
        sendResponse(response);
      } catch (err) {
        const response: LinkedInSearchExtractResponse = {
          ok: false,
          url,
          listings: [],
          error: err instanceof Error ? err.message : String(err),
        };
        sendResponse(response);
      }
      return false;
    }

    return false;
  },
);
