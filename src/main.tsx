import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

function PinGate() {
  const [pin, setPin] = useState("");
  const correctPin = import.meta.env.VITE_LOGIN_PIN;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) {
        setPin((prev) => (prev + e.key).slice(0, 9));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (pin === correctPin) {
    return <App />;
  }

  return (
    <div
      className="flex items-center justify-center h-screen bg-gray-100 overflow-hidden"
      onClick={() => {
        const hiddenInput = document.getElementById("hiddenPinInput") as HTMLInputElement;
        hiddenInput?.focus();
      }}
    >
      <input
        id="hiddenPinInput"
        type="tel"
        inputMode="numeric"
        autoComplete="one-time-code"
        className="absolute opacity-0 pointer-events-none"
        value={pin}
        onChange={(e) =>
          setPin(e.target.value.slice(0, 9))
        }
      />
      <div className="rat-animation flex items-center gap-3">
        <div className="text-6xl">🐀</div>
        <div className="bg-white border rounded-lg px-4 py-2 shadow text-lg">
          Guess the PIN!
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PinGate />
  </StrictMode>
);
