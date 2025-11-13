import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

function PinGate() {
  const [pin, setPin] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const correctPin = import.meta.env.VITE_LOGIN_PIN;

  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    // Only listen to keyboard on desktop
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) {
        setPin((prev) => (prev + e.key).slice(0, 9));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile]);

  const handlePinChange = (value: string) => {
    const numericValue = value.replace(/\D/g, "").slice(0, 9);
    setPin(numericValue);
  };

  if (pin === correctPin) {
    return <App />;
  }

  if (isPreviewMode) {
    return <App isPreviewMode={true} />;
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden p-4">
      <button
        onClick={() => setIsPreviewMode(true)}
        className="absolute top-6 right-6 bg-white rounded-lg px-4 py-2 shadow-md hover:shadow-lg transition-all text-2xl hover:border-gray-400"
      >
        👁️‍🗨️
      </button>

      <div className="text-center">
        {/* Desktop View - Hidden keyboard input */}
        {!isMobile && (
          <div className="rat-animation flex flex-col items-center gap-4">
            <div className="text-6xl animate-bounce">🐀</div>
            <div className="bg-white border border-gray-200 rounded-xl px-6 py-3 shadow-lg text-lg font-medium text-gray-800">
              Guess the PIN!
            </div>
          </div>
        )}

        {/* Mobile View - Input field */}
        {isMobile && (
          <div className="flex flex-col items-center gap-6 max-w-sm w-full">
            <div className="text-6xl animate-bounce mb-2">🐀</div>

            {!showInput ? (
              <button
                onClick={() => setShowInput(true)}
                className="bg-white border border-gray-200 rounded-xl px-6 py-3 shadow-lg text-lg font-medium text-gray-800">
                Guess the PIN!
              </button>
            ) : (
              <div className="w-full space-y-4">
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Ayrton
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={pin}
                    onChange={(e) => handlePinChange(e.target.value)}
                    placeholder="••••••"
                    autoFocus
                    maxLength={9}
                    className="w-full px-4 py-3 text-center text-2xl font-bold tracking-widest border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                  />
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PinGate />
  </StrictMode>
);
