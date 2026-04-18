import '@testing-library/jest-dom/vitest';

// jsdom ships without DataTransfer and guards HTMLInputElement.files behind a
// strict FileList check. Provide a minimal shim so the form-filler can exercise
// file uploads (resume attachment) the same way it does in Chromium.
if (typeof globalThis.DataTransfer === 'undefined') {
  class MockDataTransfer {
    private readonly _files: File[] = [];
    readonly items = {
      add: (file: File) => {
        this._files.push(file);
        return { kind: 'file' as const, type: file.type };
      },
    };
    get files(): FileList {
      const files = this._files;
      const list: Record<number, File> & {
        length: number;
        item(index: number): File | null;
        [Symbol.iterator]?: () => IterableIterator<File>;
      } = {
        length: files.length,
        item(index: number) {
          return files[index] ?? null;
        },
      };
      files.forEach((file, index) => {
        list[index] = file;
      });
      list[Symbol.iterator] = function* () {
        for (const file of files) yield file;
      };
      return list as unknown as FileList;
    }
  }
  (globalThis as unknown as { DataTransfer: typeof MockDataTransfer }).DataTransfer =
    MockDataTransfer;

  Object.defineProperty(HTMLInputElement.prototype, 'files', {
    configurable: true,
    get(this: HTMLInputElement & { _mockFiles?: FileList }) {
      return this._mockFiles ?? null;
    },
    set(this: HTMLInputElement & { _mockFiles?: FileList }, value: FileList) {
      this._mockFiles = value;
    },
  });
}
