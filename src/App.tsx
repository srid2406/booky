import { useState, useEffect } from 'react';
import { Plus, Sun, Moon } from 'lucide-react';
import ReadingArea from './components/ReadingArea';
import Library from './components/Library';
import type { Book } from './types/Book';
import { bookService } from './services/bookService';

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  // Check if desktop
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load data on component mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setLoading(true);
        setError(null);

        // Test Supabase connection
        const isConnected = await bookService.testConnection();
        if (!isConnected) {
          setError('Unable to connect to database. Please check your Supabase configuration.');
          return;
        }

        // Load books from Supabase
        const loadedBooks = await bookService.getBooks();
        setBooks(loadedBooks);

        // Load dark mode preference from localStorage
        // const savedDarkMode = localStorage.getItem('darkMode');
        // if (savedDarkMode) {
        //   setDarkMode(JSON.parse(savedDarkMode));
        // }
      } catch (error) {
        console.error('Error initializing app:', error);
        setError('Failed to load library. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [darkMode]);

  // Save dark mode preference
  // useEffect(() => {
  //   localStorage.setItem('darkMode', JSON.stringify(darkMode));
  // }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleBookSelect = (book: Book | null) => {
    setSelectedBook(book);
  };

  const handleBookClose = () => {
    setSelectedBook(null);
  };

  const handleBookUpload = (book: Book) => {
    setBooks(prevBooks => [...prevBooks, book]);
  };

  const handleBookUpdate = async (updatedBook: Book) => {
    try {
      const updated = await bookService.updateBook(updatedBook.id, updatedBook);
      setBooks(prevBooks =>
        prevBooks.map(book =>
          book.id === updated.id ? updated : book
        )
      );

      // Update selected book if it's the one being updated
      if (selectedBook && selectedBook.id === updated.id) {
        setSelectedBook(updated);
      }
    } catch (error) {
      console.error('Error updating book:', error);
      // Still update local state for better UX
      setBooks(prevBooks =>
        prevBooks.map(book =>
          book.id === updatedBook.id ? updatedBook : book
        )
      );

      if (selectedBook && selectedBook.id === updatedBook.id) {
        setSelectedBook(updatedBook);
      }
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-black' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-16 w-16 border-4 ${darkMode ? 'border-zinc-800 border-t-blue-500' : 'border-gray-300 border-t-blue-600'
            } mx-auto mb-4`}></div>
          <p className={`text-lg ${darkMode ? 'text-zinc-100' : 'text-gray-900'}`}>
            Loading your library...
          </p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-black' : 'bg-gray-50'}`}>
        <div className="text-center max-w-md p-6">
          <div className={`text-red-500 text-6xl mb-4`}>⚠️</div>
          <h2 className={`text-xl font-semibold mb-2 ${darkMode ? 'text-zinc-100' : 'text-gray-900'}`}>
            Connection Error
          </h2>
          <p className={`text-sm mb-4 ${darkMode ? 'text-zinc-500' : 'text-gray-600'}`}>
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className={`px-4 py-2 rounded-lg ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
              } text-white`}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render current view
  const renderCurrentView = () => {
    // Show PDF reader when a book is selected
    if (selectedBook) {
      return (
        <ReadingArea
          darkMode={darkMode}
          selectedBook={selectedBook}
          onBookUpdate={handleBookUpdate}
          onBookClose={handleBookClose}
        />
      );
    }

    // Show library by default
    return (
      <Library
        darkMode={darkMode}
        books={books}
        onBookUpload={handleBookUpload}
        onBookSelect={handleBookSelect}
        onBookUpdate={handleBookUpdate}
      />
    );
  };

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-black' : 'bg-gray-50'} transition-colors duration-300`}>
      {renderCurrentView()}

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 left-6 right-6 flex justify-between pointer-events-none z-50">
        {/* Dark Mode Toggle Button (left) */}
        <button
          onClick={toggleDarkMode}
          className={`pointer-events-auto w-14 h-14 rounded-full shadow-lg transition-all duration-300 hover:scale-110 border ${darkMode
            ? 'bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-800'
            : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-200'
            }`}
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? <Sun size={24} className="mx-auto" /> : <Moon size={24} className="mx-auto" />}
        </button>

        {/* Add Book Button - Only show when in library view and on desktop (right) */}
        {!selectedBook && isDesktop ? (
          <button
            onClick={() => {
              const fileInput = document.getElementById('fileInput') as HTMLInputElement;
              if (fileInput) fileInput.click();
            }}
            className={`pointer-events-auto w-14 h-14 rounded-full shadow-lg transition-all duration-300 hover:scale-110 border ${darkMode
              ? 'bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-800'
              : 'bg-white hover:bg-gray-100 text-gray-900 border-gray-200'
              }`}
            title="Add Book"
          >
            <Plus size={24} className="mx-auto" />
          </button>
        ) : (
          <div></div> // Spacer when add button is hidden
        )}
      </div>
    </div>
  );

}

export default App;