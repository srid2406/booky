-- Create books table
CREATE TABLE IF NOT EXISTS books (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  description TEXT,
  tags TEXT[],
  file_size BIGINT NOT NULL,
  total_pages INTEGER,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  current_page INTEGER DEFAULT 1,
  reading_progress DECIMAL(5,2) DEFAULT 0,
  last_read TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
);

-- Create storage bucket for PDF files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('books', 'books', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for public read access
CREATE POLICY "Public read access for books" ON storage.objects
FOR SELECT USING (bucket_id = 'books');

-- Create storage policy for authenticated upload
CREATE POLICY "Allow upload for authenticated users" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'books');

-- Create storage policy for authenticated update/delete
CREATE POLICY "Allow update/delete for authenticated users" ON storage.objects
FOR UPDATE USING (bucket_id = 'books');

CREATE POLICY "Allow delete for authenticated users" ON storage.objects
FOR DELETE USING (bucket_id = 'books');

-- Enable RLS (Row Level Security)
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access to books (you can modify this for user-specific access later)
CREATE POLICY "Public read access" ON books
FOR SELECT USING (true);

-- Create policy for public insert (you can modify this for authenticated users later)
CREATE POLICY "Public insert access" ON books
FOR INSERT WITH CHECK (true);

-- Create policy for public update
CREATE POLICY "Public update access" ON books
FOR UPDATE USING (true);

-- Create policy for public delete
CREATE POLICY "Public delete access" ON books
FOR DELETE USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_books_updated_at 
BEFORE UPDATE ON books 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_books_created_at ON books(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_books_last_read ON books(last_read DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
