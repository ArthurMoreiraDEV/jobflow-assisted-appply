# JobFlow Automation

A browser extension for semi-automated job applications on LinkedIn.

This project was designed to streamline the job application process by allowing users to search, select, queue, and apply to jobs efficiently while maintaining full control over the process.

---

## Features (MVP v1)

- Search jobs on LinkedIn by keyword and location
- Import job listings from the current tab
- Select jobs and add them to an application queue
- Process applications sequentially
- Rule-based form filling without AI
- Resume upload support
- Pause on unresolved required fields
- Application history tracking
- Reusable answers system based on manual learning

---

## How It Works

1. Define your profile, including name, email, experience, and other relevant data
2. Search for jobs on LinkedIn
3. Import job listings into the extension
4. Select relevant jobs
5. Add them to a queue
6. Start the application process
7. The extension:
   - opens the job
   - reads the form
   - fills known fields
   - pauses when needed
8. Results are stored in history

---

## Architecture

- Frontend: React + TypeScript
- Build Tool: Vite
- Extension: Chromium (Manifest V3)
- Routing: React Router (MemoryRouter)
- State: Local storage via `chrome.storage.local`
- Testing: Vitest + Testing Library

### Core Modules

- Profile
- LinkedIn Search
- Job List
- Queue Manager
- Form Parser
- Form Filler
- Executor
- Navigation Handler
- Storage

---

## Limitations (MVP)

- LinkedIn only
- No AI-based decision making
- No backend or cloud sync
- Limited form support for basic inputs
- External forms are supported but not fully optimized

---

## Running Locally

```bash
npm install
npm run dev
```
