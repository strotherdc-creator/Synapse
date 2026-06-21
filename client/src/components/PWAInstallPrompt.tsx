import { useState, useEffect } from "react";
import { X, Share, PlusSquare, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-dismissed";
const DISMISSED_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

function isDismissed(): boolean {
  const dismissed = localStorage.getItem(DISMISSED_KEY);
  if (!dismissed) return false;
  const timestamp = parseInt(dismissed, 10);
  if (Date.now() - timestamp > DISMISSED_DURATION) {
    localStorage.removeItem(DISMISSED_KEY);
    return false;
  }
  return true;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already installed or recently dismissed
    if (isInStandaloneMode() || isDismissed()) return;

    // iOS: show custom hint
    if (isIOS()) {
      // Delay slightly so it doesn't flash on page load
      const timer = setTimeout(() => setShowIOSPrompt(true), 2000);
      return () => clearTimeout(timer);
    }

    // Android/Desktop: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Show banner when prompt is available or iOS detected
  useEffect(() => {
    if (deferredPrompt || showIOSPrompt) {
      const timer = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, [deferredPrompt, showIOSPrompt]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    setTimeout(() => {
      setDeferredPrompt(null);
      setShowIOSPrompt(false);
    }, 300);
  };

  if (!visible) return null;

  // iOS-specific prompt
  if (showIOSPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="mx-auto max-w-md rounded-xl border border-gold/30 bg-card/95 backdrop-blur-sm p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gold/10 flex items-center justify-center">
              <Download className="h-5 w-5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">
                Install Synapse
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Tap{" "}
                <Share className="inline h-3.5 w-3.5 text-blue-400 -mt-0.5" />{" "}
                then{" "}
                <span className="inline-flex items-center gap-0.5">
                  <PlusSquare className="inline h-3.5 w-3.5 text-blue-400 -mt-0.5" />{" "}
                  <span className="font-medium text-foreground">
                    Add to Home Screen
                  </span>
                </span>
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 rounded-md hover:bg-accent/50 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Android/Desktop prompt
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="mx-auto max-w-md rounded-xl border border-gold/30 bg-card/95 backdrop-blur-sm p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gold/10 flex items-center justify-center">
              <Download className="h-5 w-5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">
                Install Synapse
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add to your home screen for quick access
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleDismiss}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
              >
                Later
              </button>
              <button
                onClick={handleInstall}
                className="text-xs font-semibold bg-gold text-black px-3 py-1.5 rounded-lg hover:bg-gold/90 transition-colors"
              >
                Install
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
