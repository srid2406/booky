import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database types
export interface Database {
  public: {
    Tables: {
      books: {
        Row: {
          id: string;
          title: string;
          author: string;
          description: string | null;
          tags: string[] | null;
          file_size: number;
          total_pages: number | null;
          file_url: string;
          current_page: number;
          reading_progress: number;
          last_read: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          author: string;
          description?: string | null;
          tags?: string[] | null;
          file_size: number;
          total_pages?: number | null;
          file_url: string;
          current_page?: number;
          reading_progress?: number;
          last_read?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          author?: string;
          description?: string | null;
          tags?: string[] | null;
          file_size?: number;
          total_pages?: number | null;
          file_url?: string;
          current_page?: number;
          reading_progress?: number;
          last_read?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}