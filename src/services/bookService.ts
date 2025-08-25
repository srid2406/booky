import type { Book, UploadProgress } from '../types/Book';
import { supabase } from '../config/supabase';

class BookService {
  private bucketName = 'books';

  private fromDb(record: any): Book {
    return {
      id: record.id,
      title: record.title,
      author: record.author,
      description: record.description ?? "",
      tags: record.tags ?? [],
      dateAdded: record.created_at,
      fileSize: record.file_size ?? 0,
      totalPages: record.total_pages ?? 0,
      url: record.file_url,
      currentPage: record.current_page ?? 1,
      readingProgress: record.reading_progress ?? 0,
      lastRead: record.last_read ?? null,
    };
  }

  private toDb(book: Partial<Book>): any {
    return {
      title: book.title,
      author: book.author,
      description: book.description,
      tags: book.tags,
      file_size: book.fileSize,
      total_pages: book.totalPages,
      file_url: book.url,
      current_page: book.currentPage,
      reading_progress: book.readingProgress,
      last_read: book.lastRead,
    };
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  // ---------- Upload ----------
  async uploadBook(
    file: File,
    metadata: { title?: string; author?: string; description?: string; tags?: string[] },
    onProgress?: (progress: UploadProgress) => void
  ): Promise<Book> {
    const bookId = this.generateId();

    try {
      onProgress?.({ bookId, progress: 0, status: 'uploading' });

      const fileExt = file.name.split('.').pop();
      const fileName = `${bookId}.${fileExt}`;

      onProgress?.({ bookId, progress: 25, status: 'uploading' });

      const { error: uploadError } = await supabase.storage
        .from(this.bucketName)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw new Error(`File upload failed: ${uploadError.message}`);

      onProgress?.({ bookId, progress: 50, status: 'processing' });

      const { data: urlData } = supabase.storage.from(this.bucketName).getPublicUrl(fileName);

      if (!urlData?.publicUrl) throw new Error('Failed to get file URL');

      onProgress?.({ bookId, progress: 75, status: 'processing' });

      const dbRecord = this.toDb({
        id: bookId,
        title: metadata.title || file.name.replace('.pdf', ''),
        author: metadata.author || 'Unknown Author',
        description: metadata.description,
        tags: metadata.tags,
        fileSize: file.size,
        url: urlData.publicUrl,
        currentPage: 1,
        readingProgress: 0,
      });

      const { data: insertData, error: insertError } = await supabase
        .from('books')
        .insert([dbRecord])
        .select()
        .single();

      if (insertError) throw new Error(`Database insert failed: ${insertError.message}`);

      onProgress?.({ bookId, progress: 100, status: 'completed' });

      return this.fromDb(insertData);
    } catch (error) {
      onProgress?.({
        bookId,
        progress: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Upload failed',
      });
      throw error;
    }
  }

  // ---------- Get all books ----------
  async getBooks(): Promise<Book[]> {
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .order('last_read', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw new Error(`Failed to fetch books: ${error.message}`);

      return data ? data.map(this.fromDb) : [];
    } catch (error) {
      console.error('Error fetching books:', error);
      return [];
    }
  }

  // ---------- Update book ----------
  async updateBook(bookId: string, updates: Partial<Book>): Promise<Book> {
    try {
      const dbUpdates = this.toDb({
        ...updates,
        id: bookId,
        lastRead: updates.lastRead ?? new Date().toISOString(),
      });

      const { data, error } = await supabase
        .from('books')
        .update(dbUpdates)
        .eq('id', bookId)
        .select()
        .single();

      if (error) throw new Error(`Failed to update book: ${error.message}`);

      return this.fromDb(data);
    } catch (error) {
      console.error('Error updating book:', error);
      throw error;
    }
  }

  // ---------- Delete book ----------
  async deleteBook(bookId: string): Promise<void> {
    try {
      const { data: book, error: fetchError } = await supabase
        .from('books')
        .select('file_url')
        .eq('id', bookId)
        .single();

      if (fetchError) throw new Error(`Failed to fetch book: ${fetchError.message}`);

      const filename = book.file_url.split('/').pop();

      const { error: deleteError } = await supabase.from('books').delete().eq('id', bookId);
      if (deleteError) throw new Error(`Failed to delete book record: ${deleteError.message}`);

      if (filename) {
        const { error: storageError } = await supabase.storage.from(this.bucketName).remove([filename]);
        if (storageError) console.error('Failed to delete file from storage:', storageError);
      }
    } catch (error) {
      console.error('Error deleting book:', error);
      throw error;
    }
  }

  // ---------- Reading progress ----------
  async updateReadingProgress(bookId: string, currentPage: number, totalPages: number): Promise<void> {
    const readingProgress = (currentPage / totalPages) * 100;
    await this.updateBook(bookId, {
      currentPage,
      readingProgress,
      lastRead: new Date().toISOString(),
      totalPages,
    });
  }

  // ---------- Utilities ----------
  async testConnection(): Promise<boolean> {
    try {
      const { error } = await supabase.from('books').select('count', { count: 'exact' }).limit(1);
      return !error;
    } catch (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
  }

  async getStorageStats(): Promise<{ totalBooks: number; totalSize: number }> {
    try {
      const { data, error } = await supabase.from('books').select('file_size');
      if (error) throw new Error(`Failed to fetch storage stats: ${error.message}`);

      const totalBooks = data.length;
      const totalSize = data.reduce((sum, book) => sum + book.file_size, 0);
      return { totalBooks, totalSize };
    } catch (error) {
      console.error('Error fetching storage stats:', error);
      return { totalBooks: 0, totalSize: 0 };
    }
  }
}

export const bookService = new BookService();
