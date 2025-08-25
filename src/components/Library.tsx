import React, { useState, useEffect } from 'react';
import { Book, Upload, Eye, Calendar, FileText, User, Clock } from 'lucide-react';
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

    // Generate thumbnails for books
    useEffect(() => {
        const generateThumbnails = async () => {
            for (const book of books) {
                if (!thumbnails[book.id] && book.url) {
                    try {
                        const thumbnail = await generatePDFThumbnail(book.url);
                        setThumbnails(prev => ({ ...prev, [book.id]: thumbnail }));
                    } catch (error) {
                        console.error('Error generating thumbnail for book:', book.id, error);
                    }
                }
            }
        };

        generateThumbnails();
    }, [books]);

    const generatePDFThumbnail = async (pdfUrl: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            // Create a script tag to load PDF.js
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
            // Set worker source
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

    // Listen for file input changes (triggered by floating button)
    useEffect(() => {
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
    }, []);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    const handleFileSelect = (file: File) => {
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
        if (!uploadFile) return;

        try {
            const metadata = {
                title: formData.title,
                author: formData.author,
                description: formData.description,
                tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
            };

            const book = await bookService.uploadBook(uploadFile, metadata, setUploadProgress);
            onBookUpload(book);

            // Reset form
            setShowUploadForm(false);
            setUploadFile(null);
            setFormData({ title: '', author: '', description: '', tags: '' });
            setUploadProgress(null);
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload book. Please try again.');
        }
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

    return (
        <main className={`flex-1 p-6 ${darkMode ? 'bg-gray-800' : 'bg-gray-50'} transition-colors duration-300 min-h-screen`}>
            {/* Hidden file input for floating button */}
            <input
                type="file"
                accept=".pdf"
                className="hidden"
                id="fileInput"
            />

            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className={`text-3xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            Booky
                        </h1>
                        <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Readings...
                        </p>
                    </div>
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {books.length} book{books.length !== 1 ? 's' : ''} in your library
                    </div>
                </div>

                {/* Upload Progress */}
                {uploadProgress && (
                    <div className={`mb-6 p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-md`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className={darkMode ? 'text-white' : 'text-gray-900'}>
                                {uploadProgress.status === 'uploading' ? 'Uploading...' :
                                    uploadProgress.status === 'processing' ? 'Processing...' :
                                        uploadProgress.status === 'completed' ? 'Upload Complete!' : 'Upload Failed'}
                            </span>
                            <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                                {uploadProgress.progress}%
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className={`h-2 rounded-full transition-all duration-300 ${uploadProgress.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                                    }`}
                                style={{ width: `${uploadProgress.progress}%` }}
                            />
                        </div>
                        {uploadProgress.error && (
                            <p className="text-red-500 text-sm mt-2">{uploadProgress.error}</p>
                        )}
                    </div>
                )}

                {/* Upload Form Modal */}
                {showUploadForm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className={`max-w-md w-full rounded-lg p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                            <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                Add Book Details
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Title *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className={`w-full px-3 py-2 rounded-md border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                            }`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Author
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.author}
                                        onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                        placeholder="Unknown Author"
                                        className={`w-full px-3 py-2 rounded-md border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                            }`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={3}
                                        className={`w-full px-3 py-2 rounded-md border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                            }`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Tags (comma-separated)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.tags}
                                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                        placeholder="fiction, classic, literature"
                                        className={`w-full px-3 py-2 rounded-md border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                            }`}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={handleUploadSubmit}
                                    disabled={!formData.title.trim()}
                                    className={`flex-1 px-4 py-2 rounded-lg ${!formData.title.trim()
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
                                        } text-white`}
                                >
                                    Upload Book
                                </button>
                                <button
                                    onClick={() => {
                                        setShowUploadForm(false);
                                        setUploadFile(null);
                                        setFormData({ title: '', author: '', description: '', tags: '' });
                                    }}
                                    className={`px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-600 hover:bg-gray-700' : 'bg-gray-500 hover:bg-gray-600'
                                        } text-white`}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Drag & Drop Overlay */}
                {dragActive && (
                    <div
                        className="fixed inset-0 z-40 flex items-center justify-center bg-blue-500 bg-opacity-20 backdrop-blur-sm"
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <div className={`text-center p-8 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-xl`}>
                            <Upload size={64} className="mx-auto mb-4 text-blue-500" />
                            <p className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                Drop your PDF file here
                            </p>
                        </div>
                    </div>
                )}

                {/* Books Grid */}
                {books.length === 0 ? (
                    <div
                        className={`text-center py-16 border-2 border-dashed rounded-lg transition-colors duration-200 ${darkMode ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-600'
                            }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <Book size={72} className="mx-auto mb-6 opacity-50" />
                        <h3 className="text-2xl font-semibold mb-3">No books in your library yet</h3>
                        <p className="text-lg mb-4">Start building your digital library!</p>
                        <p className="text-sm">Use the + button to add your first PDF book, or drag and drop files here</p>
                    </div>
                ) : (
                    <div
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6"
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        {books.map((book) => (
                            <div
                                key={book.id}
                                className={`rounded-lg shadow-md p-4 transition-all duration-300 hover:shadow-lg hover:scale-105 ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
                                    }`}
                            >
                                <div className={`aspect-[3/4] rounded-md mb-3 flex items-center justify-center overflow-hidden ${darkMode ? 'bg-gray-700' : 'bg-gray-100'
                                    }`}>
                                    {thumbnails[book.id] ? (
                                        <img
                                            src={thumbnails[book.id]}
                                            alt={`${book.title} thumbnail`}
                                            className="w-full h-full object-cover rounded-md"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center">
                                            <Book size={48} className={`mb-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                                            <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                Loading...
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <h3 className={`font-semibold mb-1 truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {book.title}
                                </h3>

                                <p className={`text-sm mb-2 flex items-center gap-1 truncate ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                    <User size={12} className="flex-shrink-0" />
                                    <span className="truncate">{book.author}</span>
                                </p>

                                <div className={`text-xs space-y-1 mb-3 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                    <div className="flex items-center gap-1">
                                        <Calendar size={12} />
                                        Added {formatDate(book.dateAdded)}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <FileText size={12} />
                                        {formatFileSize(book.fileSize)}
                                    </div>
                                    {book.lastRead ? (
                                        <div className="flex items-center gap-1 text-green-600">
                                            <Clock size={12} />
                                            Last read {formatDate(book.lastRead)}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-red-600">
                                            Not yet started
                                        </div>
                                    )}
                                </div>

                                {book.tags && book.tags.length > 0 && (
                                    <div className="mb-3">
                                        <div className="flex flex-wrap gap-1">
                                            {book.tags.slice(0, 2).map((tag, index) => (
                                                <span
                                                    key={index}
                                                    className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-800'
                                                        }`}
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                            {book.tags.length > 2 && (
                                                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                    +{book.tags.length - 2}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Always show reading progress, defaulting to 0% for new books */}
                                <div className="mb-3">
                                    <div className={`text-xs mb-1 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                                        {Math.round(book.readingProgress || 0)}% completed
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                        <div
                                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                            style={{ width: `${book.readingProgress || 0}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onBookSelect(book)}
                                        className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded text-sm transition-colors duration-200 ${darkMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
                                            }`}
                                    >
                                        <Eye size={14} />
                                        Read
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Bottom padding to avoid floating button overlap */}
                <div className="h-20"></div>
            </div>
        </main>
    );
};

export default Library;