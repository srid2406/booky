import React from 'react';
import type { Book as BookType } from '../types/Book';
import PDFViewer from './PDFViewer';

interface ReadingAreaProps {
  darkMode: boolean;
  selectedBook: BookType | null;
  onBookUpdate: (book: BookType) => void;
  onBookClose: () => void;
}

const ReadingArea: React.FC<ReadingAreaProps> = ({
  darkMode,
  selectedBook,
  onBookUpdate,
  onBookClose
}) => {

  const handlePageChange = (currentPage: number, totalPages: number) => {
    if (selectedBook) {
      const readingProgress = (currentPage / totalPages) * 100;
      const updatedBook = {
        ...selectedBook,
        currentPage,
        readingProgress,
        lastRead: new Date().toISOString()
      };
      onBookUpdate(updatedBook);
    }
  };

  // Show PDF viewer when a book is selected
  if (selectedBook) {
    return (
      <PDFViewer
        book={selectedBook}
        darkMode={darkMode}
        onPageChange={handlePageChange}
        onClose={onBookClose}
      />
    );
  }
};

export default ReadingArea;
