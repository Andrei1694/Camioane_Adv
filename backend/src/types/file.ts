export interface StoredUpload {
  provider: string;
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
}

/** Where a stored object lives. Private: never return it from the API. */
export interface StorageLocation {
  provider: string;
  key: string;
}

export interface FilePagination {
  limit: number;
  offset: number;
}

declare global {
  namespace Express {
    namespace Multer {
      interface File {
        storedFile?: StoredUpload;
      }
    }
  }
}
