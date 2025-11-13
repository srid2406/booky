export interface Book {
  id: string;
  title: string;
  author: string;
  dateAdded: string;
  fileSize: number;
  totalPages?: number;
  description?: string;
  tags?: string[];
  url: string;
  lastRead?: string;
  currentPage?: number;
  readingProgress?: number;
}

export interface UploadProgress {
  bookId: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}
