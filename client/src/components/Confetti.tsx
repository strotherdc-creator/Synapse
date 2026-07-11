import { useEffect, useState, useRef } from "react";

/**
 * Confetti/Fireworks celebration overlay.
 * Renders 60 animated particles that burst from center and fade out.
 * Plays a short celebration fanfare sound effect.
 * Purely visual, self-contained, no external dependencies.
 * Auto-removes itself after the animation completes (~3.5s).
 */
export function Confetti({ onComplete }: { onComplete?: () => void }) {
  const [particles] = useState(() => generateParticles(60));
  const [visible, setVisible] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play celebration sound on mount
  useEffect(() => {
    try {
      const audio = new Audio("/sounds/celebration.mp3");
      audio.volume = 0.6;
      audioRef.current = audio;
      audio.play().catch(() => {
        // Silently fail if autoplay is blocked — confetti still shows
      });
    } catch {
      // Sound is optional — don't break the celebration
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 3500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: "50%",
            top: "40%",
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: p.shape === "circle" ? "50%" : "2px",
            backgroundColor: p.color,
            opacity: 0,
            transform: "translate(-50%, -50%) scale(0)",
            animation: `confetti-burst ${p.duration}s ${p.delay}s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
            // Custom properties for the animation
            "--tx": `${p.tx}px`,
            "--ty": `${p.ty}px`,
            "--rot": `${p.rotation}deg`,
          } as React.CSSProperties}
        />
      ))}
      <style>{confettiKeyframes}</style>
    </div>
  );
}

// Generate random particles
function generateParticles(count: number) {
  const colors = [
    "#FFD700", // Gold
    "#FF6B35", // Orange
    "#00C853", // Green
    "#2979FF", // Blue
    "#AA00FF", // Purple
    "#FF1744", // Red
    "#FFEA00", // Yellow
    "#00E5FF", // Cyan
  ];
  const shapes: ("circle" | "square")[] = ["circle", "square"];

  return Array.from({ length: count }, () => {
    const angle = Math.random() * 360;
    const distance = 150 + Math.random() * 350;
    const rad = (angle * Math.PI) / 180;
    return {
      tx: Math.cos(rad) * distance,
      ty: Math.sin(rad) * distance - 100, // bias upward
      rotation: Math.random() * 720 - 360,
      size: 6 + Math.random() * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      duration: 1.5 + Math.random() * 1.5,
      delay: Math.random() * 0.4,
    };
  });
}

const confettiKeyframes = `
@keyframes confetti-burst {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) translate(0, 0) rotate(0deg);
  }
  70% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.5) translate(var(--tx), var(--ty)) rotate(var(--rot));
  }
}
`;
