import React, { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  BookOpen,
  Maximize2,
} from "lucide-react";
import type { Book } from "../types/Book";

interface PDFViewerProps {
  book: Book;
  darkMode: boolean;
  onPageChange?: (currentPage: number, totalPages: number) => void;
  onClose?: () => void;
}

// Declare pdfjs for TypeScript
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  book,
  onPageChange,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(book.currentPage || 1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);

  // load pdf.js script
  useEffect(() => {
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        loadPDF();
      }
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    // hide scrollbars when PDF is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    if (pdfDoc && currentPage <= totalPages) {
      renderPage();
      onPageChange?.(currentPage, totalPages);
    }
  }, [pdfDoc, currentPage, scale, rotation]);

  // scroll navigation (desktop)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY > 0) goToPage(currentPage + 1);
      else if (e.deltaY < 0) goToPage(currentPage - 1);
    };
    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [currentPage, totalPages]);

  // fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!document.fullscreenElement;
      setIsFocusMode(isFullscreen);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // tap navigation (mobile)
  const handleTap = (e: React.TouchEvent) => {
    const x = e.changedTouches[0].clientX;
    const width = window.innerWidth;
    if (x < width / 2) goToPage(currentPage - 1);
    else goToPage(currentPage + 1);
  };

  const loadPDF = async () => {
    try {
      setLoading(true);
      setError(null);

      const pdf = await window.pdfjsLib.getDocument(book.url).promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(book.currentPage || 1);

      setRotation(0);
    } catch (err) {
      setError("Failed to load PDF. Please check if the file is accessible.");
      console.error("Error loading PDF:", err);
    } finally {
      setLoading(false);
    }
  };

  const renderPage = async () => {
    if (!pdfDoc || !canvasRef.current) return;

    const page = await pdfDoc.getPage(currentPage);
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;

    const safeRotation = 0;

    const viewport = page.getViewport({ scale: 1, rotation: safeRotation });
    const scaleFactor =
      Math.min(
        containerWidth / viewport.width,
        containerHeight / viewport.height
      ) * scale;

    const scaledViewport = page.getViewport({
      scale: scaleFactor,
      rotation: safeRotation,
    });
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    await page.render({ canvasContext: context!, viewport: scaledViewport })
      .promise;
  };

  const goToPage = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    }
  };

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pageNum = parseInt(e.target.value);
    if (!isNaN(pageNum)) {
      goToPage(pageNum);
    }
  };

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));

  const downloadPDF = () => {
    const link = document.createElement("a");
    link.href = book.url;
    link.download = `${book.title}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleFocusMode = async () => {
    if (!document.fullscreenElement && containerRef.current) {
      await containerRef.current.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const progressPercent = Math.round((currentPage / totalPages) * 100);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-screen w-screen"
        style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
      >
        <div className="text-center">
          <BookOpen size={48} className="mx-auto mb-4 animate-pulse" />
          <p className="text-lg">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center h-screen w-screen"
        style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
      >
        <div className="text-center">
          <div style={{ color: "red" }} className="mb-4">
            ⚠️
          </div>
          <p className="text-lg mb-4">{error}</p>
          <button
            onClick={loadPDF}
            className="px-4 py-2 rounded-lg text-white"
            style={{ backgroundColor: "var(--button-bg)" }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-screen w-screen"
      style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
    >
      {/* Header + Toolbar (hidden in focus mode) */}
      {!isFocusMode && (
        <>
          {/* Header */}
          <div
            className="flex items-center justify-between p-2 border-b"
            style={{
              backgroundColor: "var(--toolbar-bg)",
              borderColor: "var(--border-color)",
            }}
          >
            <div className="flex items-center gap-2">
              <div>
                <h2 className="text-sm font-semibold">{book.title}</h2>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  by {book.author}
                </span>
              </div>
              {/* Circular Reading Progress */}
              <div className="relative w-8 h-8">
                <svg className="w-8 h-8 transform -rotate-90">
                  <circle
                    cx="16"
                    cy="16"
                    r="14"
                    stroke="var(--progress-bg)"
                    strokeWidth="3"
                    fill="none"
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r="14"
                    stroke="var(--progress-fill)"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={2 * Math.PI * 14}
                    strokeDashoffset={
                      2 * Math.PI * 14 * (1 - progressPercent / 100)
                    }
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold">
                  {progressPercent}%
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="px-2 py-1 text-xs rounded-md"
              style={{ backgroundColor: "var(--button-bg)", color: "#fff" }}
            >
              Close
            </button>
          </div>

          {/* Toolbar */}
          <div
            className="flex flex-wrap items-center justify-between p-2 border-b gap-2"
            style={{
              backgroundColor: "var(--toolbar-bg)",
              borderColor: "var(--border-color)",
            }}
          >
            <div className="flex items-center gap-1">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-1 rounded-md"
                style={{
                  color:
                    currentPage <= 1 ? "var(--text-muted)" : "var(--text-color)",
                }}
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={currentPage}
                  onChange={handlePageInput}
                  min="1"
                  max={totalPages}
                  className="w-12 px-1 py-0.5 text-center text-xs rounded border"
                  style={{
                    backgroundColor: "var(--bg-color)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-color)",
                  }}
                />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  of {totalPages}
                </span>
              </div>

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="p-1 rounded-md"
                style={{
                  color:
                    currentPage >= totalPages
                      ? "var(--text-muted)"
                      : "var(--text-color)",
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={zoomOut}
                className="p-1 rounded-md"
                style={{ color: "var(--text-color)" }}
              >
                <ZoomOut size={14} />
              </button>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={zoomIn}
                className="p-1 rounded-md"
                style={{ color: "var(--text-color)" }}
              >
                <ZoomIn size={14} />
              </button>
              <button
                onClick={downloadPDF}
                className="p-1 rounded-md"
                style={{ color: "var(--text-color)" }}
              >
                <Download size={14} />
              </button>
              <button
                onClick={toggleFocusMode}
                className="p-1 rounded-md"
                style={{ color: "var(--text-color)" }}
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* PDF Canvas */}
      <div
        className="flex-1 flex justify-center items-center overflow-hidden"
        onTouchEnd={handleTap}
      >
        <canvas
          ref={canvasRef}
          className="shadow-lg"
          style={{
            backgroundColor: "#fff",
            maxWidth: "100%",
            maxHeight: "100%",
          }}
        />
      </div>
    </div>
  );
};

export default PDFViewer;
