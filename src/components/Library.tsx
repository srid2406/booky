import React, { useState, useEffect, useMemo } from 'react';
import { Book, Upload, Calendar, FileText, User, Search, Plus } from 'lucide-react';
import type { Book as BookType, UploadProgress } from '../types/Book';
import { bookService } from '../services/bookService';

// PDF.js type declarations
declare global {
    interface Window {
        pdfjsLib: any;
    }
}

interface LibraryProps {
    darkMode: boolean;
    books: BookType[];
    onBookUpload: (book: BookType) => void;
    onBookSelect: (book: BookType) => void;
    onBookUpdate: (book: BookType) => void;
    isPreviewMode?: boolean;
}

interface BookFormData {
    title: string;
    author: string;
    description: string;
    tags: string;
}

const Library: React.FC<LibraryProps> = ({
    darkMode,
    books,
    onBookUpload,
    onBookSelect,
    isPreviewMode = false,
}) => {
    const [dragActive, setDragActive] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [formData, setFormData] = useState<BookFormData>({
        title: '',
        author: '',
        description: '',
        tags: ''
    });
    const [thumbnails, setThumbnails] = useState<{ [bookId: string]: string }>({});
    const [loadingThumbnails, setLoadingThumbnails] = useState<{ [bookId: string]: boolean }>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        const check = () => setIsDesktop(window.innerWidth >= 640);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const filteredBooks = useMemo(() => {
        return books.filter((book) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (
                book.title.toLowerCase().includes(q) ||
                book.author.toLowerCase().includes(q) ||
                (book.tags && book.tags.some((tag: string) => tag.toLowerCase().includes(q)))
            );
        });
    }, [books, searchQuery]);

    // Lazy load thumbnails using Intersection Observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const bookId = entry.target.getAttribute('data-book-id');
                        if (bookId) {
                            loadThumbnail(bookId);
                            observer.unobserve(entry.target);
                        }
                    }
                });
            },
            { rootMargin: '50px' }
        );

        const thumbnailElements = document.querySelectorAll('[data-book-id]');
        thumbnailElements.forEach((el) => observer.observe(el));

        return () => observer.disconnect();
    }, [books]);

    const loadThumbnail = async (bookId: string) => {
        const book = books.find(b => b.id === bookId);
        if (!book || thumbnails[bookId] || loadingThumbnails[bookId]) return;

        setLoadingThumbnails(prev => ({ ...prev, [bookId]: true }));
        try {
            const thumbnail = await generatePDFThumbnail(book.url);
            setThumbnails(prev => ({ ...prev, [bookId]: thumbnail }));
        } catch (error) {
            console.error('Error generating thumbnail for book:', bookId, error);
        } finally {
            setLoadingThumbnails(prev => ({ ...prev, [bookId]: false }));
        }
    };

    const generatePDFThumbnail = async (pdfUrl: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (!window.pdfjsLib) {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                script.onload = () => {
                    generateThumbnailWithPDFJS(pdfUrl, resolve, reject);
                };
                script.onerror = reject;
                document.head.appendChild(script);
            } else {
                generateThumbnailWithPDFJS(pdfUrl, resolve, reject);
            }
        });
    };

    const generateThumbnailWithPDFJS = async (pdfUrl: string, resolve: (value: string) => void, reject: (reason?: any) => void) => {
        try {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

            const pdf = await window.pdfjsLib.getDocument(pdfUrl).promise;
            const page = await pdf.getPage(1);

            const viewport = page.getViewport({ scale: 0.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
            resolve(thumbnail);
        } catch (error) {
            reject(error);
        }
    };

    useEffect(() => {
        if (isPreviewMode) return;

        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
        if (fileInput) {
            const handleFileChange = (e: Event) => {
                const target = e.target as HTMLInputElement;
                if (target.files && target.files[0]) {
                    handleFileSelect(target.files[0]);
                }
            };
            fileInput.addEventListener('change', handleFileChange);
            return () => fileInput.removeEventListener('change', handleFileChange);
        }
    }, [isPreviewMode]);

    const handleDrag = (e: React.DragEvent) => {
        if (!isDesktop || isPreviewMode) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        if (!isDesktop || isPreviewMode) return;
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    const handleFileSelect = (file: File) => {
        if (isPreviewMode) return;

        if (file.type !== 'application/pdf') {
            alert('Please select a PDF file');
            return;
        }

        setUploadFile(file);
        setFormData({
            title: file.name.replace('.pdf', ''),
            author: '',
            description: '',
            tags: ''
        });
        setShowUploadForm(true);
    };

    const handleUploadSubmit = async () => {
        if (!uploadFile || isPreviewMode) return;

        setShowUploadForm(false);

        try {
            const metadata = {
                title: formData.title,
                author: formData.author,
                description: formData.description,
                tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
            };

            const book = await bookService.uploadBook(uploadFile, metadata, setUploadProgress);
            onBookUpload(book);

            setUploadFile(null);
            setFormData({ title: '', author: '', description: '', tags: '' });

            setTimeout(() => {
                setUploadProgress(null);
            }, 2000);
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload book. Please try again.');
            setUploadProgress(null);
        }
    };

    const handleBookClick = (book: BookType) => {
        if (isPreviewMode) {
            return;
        }
        onBookSelect(book);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatFileSize = (bytes: number) => {
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    };

    const getEmptyStateMessage = () => {
        if (searchQuery) {
            return `No books match "${searchQuery}". Try adjusting your search.`;
        }
        if (isPreviewMode) {
            return 'This library is currently empty';
        }
        return 'Your library awaits. Start your reading journey today';
    };

    const countBoxClasses = darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200 shadow-md';
    const countTextClasses = darkMode ? 'text-zinc-100' : 'text-gray-900';
    const bookIconClasses = darkMode ? 'text-zinc-400' : 'text-gray-600';

    return (
        <main className={`flex-1 ${darkMode ? 'bg-black' : 'bg-slate-50'} transition-all duration-500 min-h-screen`}>
            {!isPreviewMode && (
                <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    id="fileInput"
                />
            )}

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                {/* Mobile Header */}
                <div className="sm:hidden mb-6">
                    <div className={`relative rounded-lg border p-0.5 flex items-center w-full ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}`}>
                        <Search size={16} className={`ml-3 ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`} />
                        <input
                            type="text"
                            placeholder="Search books..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`flex-1 px-3 py-2 text-sm outline-none bg-transparent ${darkMode ? 'text-zinc-100 placeholder-zinc-500' : 'text-gray-900 placeholder-gray-500'}`}
                        />
                    </div>
                </div>

                {/* Desktop Header */}
                <div className="hidden sm:block mb-12">
                    <div className="flex items-center justify-between mb-8">
                        <div className={`relative flex-1 mr-4 rounded-xl border p-1 flex items-center ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white shadow-lg'}`}>
                            <Search size={18} className={`ml-4 ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`} />
                            <input
                                type="text"
                                placeholder="Search by title, author, tags..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={`flex-1 px-4 py-3 outline-none bg-transparent ${darkMode ? 'text-zinc-100 placeholder-zinc-500' : 'text-gray-900 placeholder-gray-500'}`}
                            />
                        </div>

                        <div className={`flex items-center gap-3 px-6 py-3 rounded-xl border ${countBoxClasses}`}>
                            <Book className={`w-6 h-6 ${bookIconClasses}`} />
                            <div>
                                <div className={`text-2xl font-bold ${countTextClasses}`}>
                                    {filteredBooks.length}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Upload Progress Modal */}
                {uploadProgress && !isPreviewMode && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className={`w-full max-w-md rounded-xl p-6 sm:p-8 border ${darkMode ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-gray-200 shadow-2xl'}`}>
                            <div className="flex flex-col items-center">
                                <div className="relative mb-4 sm:mb-6">
                                    {uploadProgress.status === 'uploading' || uploadProgress.status === 'processing' ? (
                                        <div className="relative">
                                            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 ${darkMode ? 'border-zinc-800' : 'border-gray-200'}`}></div>
                                            <div className={`absolute inset-0 w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-transparent ${darkMode ? 'border-t-white' : 'border-t-black'} animate-spin`}></div>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Upload className={`w-8 h-8 sm:w-10 sm:h-10 ${darkMode ? 'text-white' : 'text-black'}`} />
                                            </div>
                                        </div>
                                    ) : uploadProgress.status === 'completed' ? (
                                        <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center border ${darkMode ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'}`}>
                                            <svg className={`w-10 h-10 sm:w-12 sm:h-12 ${darkMode ? 'text-green-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    ) : (
                                        <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center border ${darkMode ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'}`}>
                                            <svg className={`w-10 h-10 sm:w-12 sm:h-12 ${darkMode ? 'text-red-400' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </div>
                                    )}
                                </div>

                                <h3 className={`text-xl sm:text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-black'}`}>
                                    {uploadProgress.status === 'uploading' ? 'Uploading...' :
                                        uploadProgress.status === 'processing' ? 'Processing...' :
                                            uploadProgress.status === 'completed' ? 'Upload Complete!' : 'Upload Failed'}
                                </h3>

                                <p className={`text-sm mb-4 sm:mb-6 ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                                    {uploadProgress.status === 'uploading' ? 'Sending your book to the library' :
                                        uploadProgress.status === 'processing' ? 'Preparing your book for reading' :
                                            uploadProgress.status === 'completed' ? 'Your book is ready to read' : 'Something went wrong'}
                                </p>

                                {(uploadProgress.status === 'uploading' || uploadProgress.status === 'processing') && (
                                    <div className="w-full">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className={`text-xs sm:text-sm font-medium ${darkMode ? 'text-zinc-400' : 'text-gray-700'}`}>
                                                Progress
                                            </span>
                                            <span className={`text-xs sm:text-sm font-bold ${darkMode ? 'text-white' : 'text-black'}`}>
                                                {uploadProgress.progress}%
                                            </span>
                                        </div>
                                        <div className={`w-full h-2 rounded-full overflow-hidden ${darkMode ? 'bg-zinc-800' : 'bg-gray-200'}`}>
                                            <div
                                                className={`h-full transition-all duration-300 ease-out ${darkMode ? 'bg-white' : 'bg-black'}`}
                                                style={{ width: `${uploadProgress.progress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {uploadProgress.error && (
                                    <div className={`mt-4 p-3 sm:p-4 rounded-lg w-full ${darkMode ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
                                        <p className={`text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{uploadProgress.error}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Upload Form Modal */}
                {showUploadForm && !isPreviewMode && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className={`w-full max-w-lg rounded-xl p-6 sm:p-8 border ${darkMode ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-gray-200 shadow-2xl'}`}>
                            <h3 className={`text-xl sm:text-2xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-black'}`}>
                                📚 Add Book Details
                            </h3>
                            <div className="space-y-4 sm:space-y-5">
                                <div>
                                    <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-zinc-300' : 'text-gray-700'}`}>
                                        Title *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border transition-all duration-200 focus:outline-none focus:ring-1 ${darkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:ring-white focus:border-zinc-700' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-black focus:border-gray-400'}`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-zinc-300' : 'text-gray-700'}`}>
                                        Author
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.author}
                                        onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                        placeholder="Unknown Author"
                                        className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border transition-all duration-200 focus:outline-none focus:ring-1 ${darkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:ring-white focus:border-zinc-700' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-black focus:border-gray-400'}`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-zinc-300' : 'text-gray-700'}`}>
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={3}
                                        className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border transition-all duration-200 focus:outline-none focus:ring-1 resize-none ${darkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:ring-white focus:border-zinc-700' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-black focus:border-gray-400'}`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-zinc-300' : 'text-gray-700'}`}>
                                        Tags (comma-separated)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.tags}
                                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                        placeholder="fiction, classic, literature"
                                        className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border transition-all duration-200 focus:outline-none focus:ring-1 ${darkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:ring-white focus:border-zinc-700' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-black focus:border-gray-400'}`}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 mt-6 sm:mt-8">
                                <button
                                    onClick={handleUploadSubmit}
                                    disabled={!formData.title.trim()}
                                    className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold transition-all duration-200 ${!formData.title.trim()
                                        ? 'bg-zinc-700 cursor-not-allowed text-zinc-400'
                                        : darkMode ? 'bg-white hover:bg-zinc-100 text-black' : 'bg-black hover:bg-gray-900 text-white'
                                        } transform hover:scale-105 w-full sm:flex-1`}
                                >
                                    Upload Book
                                </button>
                                <button
                                    onClick={() => {
                                        setShowUploadForm(false);
                                        setUploadFile(null);
                                        setFormData({ title: '', author: '', description: '', tags: '' });
                                    }}
                                    className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold border transition-all duration-200 ${darkMode ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-100' : 'bg-white hover:bg-gray-50 border-gray-300 text-gray-700'} transform hover:scale-105 w-full sm:w-auto`}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Drag & Drop Overlay */}
                {dragActive && isDesktop && !isPreviewMode && (
                    <div
                        className="fixed inset-0 z-40 flex items-center justify-center bg-blue-500/10 backdrop-blur-md"
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <div className={`text-center p-8 sm:p-12 rounded-2xl border-2 border-blue-500 shadow-2xl w-full max-w-sm ${darkMode ? 'bg-zinc-900' : 'bg-white'}`}>
                            <Upload className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 text-blue-500 animate-pulse" />
                            <p className={`text-xl sm:text-2xl font-bold mb-2 ${darkMode ? 'text-zinc-100' : 'text-gray-900'}`}>
                                Drop your PDF here
                            </p>
                            <p className={`text-sm ${darkMode ? 'text-zinc-500' : 'text-gray-600'}`}>
                                Release to upload
                            </p>
                        </div>
                    </div>
                )}

                {/* Books Grid or Empty State */}
                {filteredBooks.length === 0 ? (
                    <div
                        className={`text-center py-12 sm:py-24 border rounded-2xl transition-all duration-300 ${darkMode ? 'border-zinc-800 bg-zinc-900 hover:border-zinc-700' : 'border-gray-200 bg-white/50 hover:border-blue-400/50'}`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <div className="mb-6 sm:mb-8">
                            <Book className={`mx-auto mb-4 sm:mb-6 w-12 h-12 sm:w-24 sm:h-24 ${darkMode ? 'text-zinc-700' : 'text-gray-300'}`} />
                        </div>
                        <h3 className={`text-2xl sm:text-3xl font-bold mb-4 ${darkMode ? 'text-zinc-100' : 'text-gray-900'}`}>
                            {searchQuery ? 'Nothing here yet' : isPreviewMode ? 'Empty Library' : 'Your library awaits'}
                        </h3>
                        <p className={`text-base sm:text-lg mb-2 ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                            {getEmptyStateMessage()}
                        </p>
                        {!isPreviewMode && (
                            <p className={`text-sm ${darkMode ? 'text-zinc-600' : 'text-gray-500'}`}>
                                {isDesktop ? 'Click the + button or drag & drop PDF files to get started' : 'Add your first book from desktop to start your library'}
                            </p>
                        )}
                    </div>
                ) : (
                    <div
                        className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-6"
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        {filteredBooks.map((book) => (
                            <div
                                key={book.id}
                                data-book-id={book.id}
                                className={`group rounded-lg p-2 sm:p-5 transition-all duration-300 hover:-translate-y-1 flex flex-col cursor-pointer border ${darkMode ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}
                                onClick={() => handleBookClick(book)}
                            >
                                <div className={`relative aspect-[3/4] rounded-md mb-2 sm:mb-4 overflow-hidden ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                                    {thumbnails[book.id] ? (
                                        <img
                                            src={thumbnails[book.id]}
                                            alt={`${book.title} cover`}
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center">
                                            {loadingThumbnails[book.id] ? (
                                                <>
                                                    <div className={`animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-2 mb-1 sm:mb-2 ${darkMode ? 'border-zinc-800 border-t-blue-500' : 'border-gray-300 border-t-blue-500'}`}></div>
                                                    <div className={`text-xs sm:text-sm ${darkMode ? 'text-zinc-600' : 'text-gray-500'}`}>
                                                        Loading...
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <Book className={`mb-1 sm:mb-2 w-8 h-8 sm:w-14 sm:h-14 ${darkMode ? 'text-zinc-700' : 'text-gray-400'}`} />
                                                    <div className={`text-xs ${darkMode ? 'text-zinc-600' : 'text-gray-400'}`}>
                                                        No preview
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {!isPreviewMode && book.readingProgress && book.readingProgress > 0 && (
                                        <div className="absolute top-1 right-1">
                                            <div className={`px-1.5 sm:px-3 py-0.5 rounded-md text-xs font-medium ${darkMode ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' : 'bg-gray-100 text-gray-900 border border-gray-200'}`}>
                                                {Math.round(book.readingProgress)}%
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col flex-1 space-y-1">
                                    <h3
                                        className={`font-semibold text-xs sm:text-base leading-tight line-clamp-2 ${darkMode ? 'text-zinc-100' : 'text-gray-900'}`}
                                        style={{ minHeight: '2.6em' }}
                                    >
                                        {book.title}
                                    </h3>

                                    <div className="h-4">
                                        <p className={`text-xs flex items-center gap-1 ${darkMode ? 'text-zinc-500' : 'text-gray-600'}`}>
                                            <User size={10} className="flex-shrink-0" />
                                            <span className="truncate">{book.author}</span>
                                        </p>
                                    </div>

                                    <div className="hidden sm:block mb-2 sm:mb-3 h-7">
                                        {book.tags && book.tags.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {book.tags.slice(0, 2).map((tag, index) => (
                                                    <span
                                                        key={index}
                                                        className={`text-xs px-2 py-0.5 rounded-md font-medium border ${darkMode ? 'bg-zinc-950 text-zinc-400 border-zinc-800' : 'bg-gray-50 text-gray-700 border-gray-200'}`}
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                                {book.tags.length > 2 && (
                                                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${darkMode ? 'bg-zinc-950 text-zinc-500 border border-zinc-800' : 'bg-gray-100 text-gray-600'}`}>
                                                        +{book.tags.length - 2}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="h-full"></div>
                                        )}
                                    </div>

                                    <div className={`hidden sm:block text-xs mb-2 sm:mb-3 h-12 ${darkMode ? 'text-zinc-600' : 'text-gray-500'}`}>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1">
                                                <FileText size={10} className="flex-shrink-0 sm:w-3 sm:h-3" />
                                                <span>{formatFileSize(book.fileSize)}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Calendar size={10} className="flex-shrink-0 sm:w-3 sm:h-3" />
                                                <span>Added {formatDate(book.dateAdded)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="h-16 sm:h-20"></div>
            </div>

            {isDesktop && !isPreviewMode && (
                <button
                    onClick={() => {
                        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
                        fileInput?.click();
                    }}
                    className={`hidden sm:flex fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg items-center justify-center z-40 transition-all duration-300 hover:scale-110 border ${darkMode ? 'bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-800' : 'bg-white hover:bg-gray-50 text-gray-900 border-gray-200'}`}
                >
                    <Plus size={20} />
                </button>
            )}
        </main>
    );
};

export default Library;
