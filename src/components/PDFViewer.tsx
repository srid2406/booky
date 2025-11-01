import React, { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  BookOpen,
  Maximize2,
  BookMarked,
  Scroll,
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(book.currentPage || 1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, _setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'scroll'>('single');
  const [renderedPages, setRenderedPages] = useState<Map<number, HTMLCanvasElement>>(new Map());
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1]));

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
    if (pdfDoc && currentPage <= totalPages && viewMode === 'single') {
      renderPage();
      onPageChange?.(currentPage, totalPages);
    }
  }, [pdfDoc, currentPage, scale, rotation, viewMode]);

  // scroll navigation (desktop) - only for single page mode
  useEffect(() => {
    if (viewMode !== 'single') return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY > 0) goToPage(currentPage + 1);
      else if (e.deltaY < 0) goToPage(currentPage - 1);
    };
    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [currentPage, totalPages, viewMode]);

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

  // Scroll mode: Intersection Observer for lazy loading
  useEffect(() => {
    if (viewMode !== 'scroll' || !scrollContainerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let maxPage = currentPage;

        entries.forEach((entry) => {
          const pageNum = parseInt(entry.target.getAttribute('data-page') || '0');

          if (entry.isIntersecting) {
            setVisiblePages((prev) => new Set(prev).add(pageNum));

            // Find the page with maximum intersection ratio
            if (entry.intersectionRatio > maxRatio) {
              maxRatio = entry.intersectionRatio;
              maxPage = pageNum;
            }
          } else {
            setVisiblePages((prev) => {
              const newSet = new Set(prev);
              newSet.delete(pageNum);
              return newSet;
            });
          }
        });

        // Update to the most visible page
        if (maxRatio > 0.1) { // Only update if at least 10% visible
          setCurrentPage(maxPage);
          onPageChange?.(maxPage, totalPages);
        }
      },
      {
        root: scrollContainerRef.current,
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
        rootMargin: '-20% 0px -20% 0px',
      }
    );

    const pageElements = scrollContainerRef.current.querySelectorAll('.pdf-page-container');
    pageElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [viewMode, totalPages, pdfDoc]);

  // Render visible pages in scroll mode
  useEffect(() => {
    if (viewMode !== 'scroll' || !pdfDoc) return;

    visiblePages.forEach(async (pageNum) => {
      if (!renderedPages.has(pageNum)) {
        await renderScrollPage(pageNum);
      }
    });
  }, [visiblePages, pdfDoc, scale, viewMode]);

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

  const renderScrollPage = async (pageNum: number) => {
    if (!pdfDoc) return;

    try {
      const page = await pdfDoc.getPage(pageNum);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      const containerWidth = scrollContainerRef.current?.clientWidth || window.innerWidth;
      const safeRotation = 0;

      const viewport = page.getViewport({ scale: 1, rotation: safeRotation });
      // Reduce the scale factor to make pages smaller in scroll mode
      const scaleFactor = (containerWidth * 0.8) / viewport.width * scale;

      const scaledViewport = page.getViewport({
        scale: scaleFactor,
        rotation: safeRotation,
      });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      await page.render({ canvasContext: context!, viewport: scaledViewport }).promise;

      setRenderedPages((prev) => {
        const newMap = new Map(prev);
        newMap.set(pageNum, canvas);
        return newMap;
      });
    } catch (err) {
      console.error(`Error rendering page ${pageNum}:`, err);
    }
  };

  const scrollToPage = async (pageNum: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Ensure the page is rendered
    if (!renderedPages.has(pageNum)) {
      await renderScrollPage(pageNum);
    }

    // Wait for DOM updates
    await new Promise(resolve => requestAnimationFrame(resolve));

    const pageElement = container.querySelector(`[data-page="${pageNum}"]`) as HTMLElement;
    if (pageElement) {
      const elementTop = pageElement.offsetTop;
      const offset = Math.max(20, window.innerHeight * 0.05); // 5% of viewport height or 20px
      container.scrollTo({
        top: elementTop - offset,
        behavior: 'auto' // Instant jump, no smooth effect
      });
    }
  };

  const goToPage = async (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);

      // In scroll mode, instantly jump to the page (render if needed, then scroll)
      if (viewMode === 'scroll' && scrollContainerRef.current) {
        await scrollToPage(pageNum);
      }
    }
  };

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pageNum = parseInt(e.target.value);
    if (!isNaN(pageNum)) {
      goToPage(pageNum);
    }
  };

  // const zoomIn = () => {
  //   setScale((prev) => {
  //     const newScale = Math.min(prev + 0.25, 3);
  //     if (viewMode === 'scroll') {
  //       setRenderedPages(new Map());
  //     }
  //     return newScale;
  //   });
  // };

  // const zoomOut = () => {
  //   setScale((prev) => {
  //     const newScale = Math.max(prev - 0.25, 0.5);
  //     if (viewMode === 'scroll') {
  //       setRenderedPages(new Map());
  //     }
  //     return newScale;
  //   });
  // };

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

  const toggleViewMode = () => {
    const previousPage = currentPage;
    const isSwitchingToScroll = viewMode === 'single';

    setViewMode((prev) => prev === 'single' ? 'scroll' : 'single');
    setRenderedPages(new Map());
    setVisiblePages(new Set([previousPage]));

    // If switching to scroll mode, instantly jump to the current page after a short delay for state updates and initial rendering
    if (isSwitchingToScroll) {
      setTimeout(async () => {
        await scrollToPage(previousPage);
      }, 150); // Adjusted delay to allow initial visible page rendering
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
      {/* Toolbar (hidden in focus mode) */}
      {!isFocusMode && (
        <div
          className="flex flex-wrap items-center justify-between p-3 border-b gap-3"
          style={{
            backgroundColor: "var(--toolbar-bg)",
            borderColor: "var(--border-color)",
          }}
        >
          {/* Book Info Section */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <h2 className="text-sm font-semibold">{book.title}</h2>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                by {book.author}
              </span>
            </div>
            {/* Circular Reading Progress */}
            <div className="relative w-10 h-10">
              <svg className="w-10 h-10 transform -rotate-90">
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  stroke="var(--progress-bg)"
                  strokeWidth="3"
                  fill="none"
                />
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  stroke="var(--progress-fill)"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray={2 * Math.PI * 16}
                  strokeDashoffset={
                    2 * Math.PI * 16 * (1 - progressPercent / 100)
                  }
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                {progressPercent}%
              </span>
            </div>
          </div>

          {/* Navigation Section */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-md"
              style={{
                color:
                  currentPage <= 1 ? "var(--text-muted)" : "var(--text-color)",
              }}
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={currentPage}
                onChange={handlePageInput}
                min="1"
                max={totalPages}
                className="w-14 px-2 py-1 text-center text-sm rounded border"
                style={{
                  backgroundColor: "var(--bg-color)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-color)",
                }}
              />
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                of {totalPages}
              </span>
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-md"
              style={{
                color:
                  currentPage >= totalPages
                    ? "var(--text-muted)"
                    : "var(--text-color)",
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Controls Section */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleViewMode}
              className="p-1.5 rounded-md"
              style={{ color: "var(--text-color)" }}
              title={viewMode === 'single' ? 'Switch to Scroll View' : 'Switch to Single Page'}
            >
              {viewMode === 'single' ? <Scroll size={16} /> : <BookMarked size={16} />}
            </button>
            <button
              onClick={downloadPDF}
              className="p-1.5 rounded-md"
              style={{ color: "var(--text-color)" }}
            >
              <Download size={16} />
            </button>
            <button
              onClick={toggleFocusMode}
              className="p-1.5 rounded-md"
              style={{ color: "var(--text-color)" }}
            >
              <Maximize2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-md ml-2"
              style={{ backgroundColor: "var(--button-bg)", color: "#fff" }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* PDF Canvas */}
      {viewMode === 'single' ? (
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
      ) : (
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{
            scrollBehavior: 'smooth',
          }}
        >
          <div className="flex flex-col items-center gap-4 py-4">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
              const canvas = renderedPages.get(pageNum);
              return (
                <div
                  key={pageNum}
                  data-page={pageNum}
                  className="pdf-page-container shadow-lg"
                  style={{
                    backgroundColor: "#fff",
                    minHeight: canvas ? undefined : "600px",
                    width: "80%",
                    maxWidth: "900px",
                  }}
                >
                  {canvas ? (
                    <canvas
                      ref={(el) => {
                        if (el && canvas) {
                          el.width = canvas.width;
                          el.height = canvas.height;
                          const ctx = el.getContext('2d');
                          if (ctx) ctx.drawImage(canvas, 0, 0);
                        }
                      }}
                      style={{
                        width: "100%",
                        height: "auto",
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center" style={{ color: "var(--text-muted)" }}>
                        <BookOpen size={32} className="mx-auto mb-2 animate-pulse" />
                        <p className="text-sm">Loading page {pageNum}...</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFViewer;