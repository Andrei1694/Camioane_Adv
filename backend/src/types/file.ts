export interface StoredUpload {
  provider: string;
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
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
