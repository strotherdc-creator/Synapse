/**
 * SynapseLogo — cohesive branding component.
 * Uses pre-sized PNG assets for pixel-perfect rendering.
 * 
 * Variants:
 *   hero     — 240px tall, landing page centerpiece
 *   sidebar  — 80px tall, desktop sidebar header
 *   header   — 44px tall, landing page top bar
 *   footer   — 60px tall, landing page footer
 *   mobile   — 32px icon, mobile header bar
 *   compact  — 28px icon, collapsed sidebar
 *   watermark — 24px icon, page footer watermark
 */

type LogoVariant = "hero" | "sidebar" | "header" | "footer" | "mobile" | "compact" | "watermark";

const VARIANTS: Record<LogoVariant, { src: string; height: number; alt: string }> = {
  hero:      { src: "/images/synapse-logo-hero.png",    height: 240, alt: "Synapse App" },
  sidebar:   { src: "/images/synapse-logo-sidebar.png", height: 80,  alt: "Synapse App" },
  header:    { src: "/images/synapse-logo-header.png",  height: 44,  alt: "Synapse App" },
  footer:    { src: "/images/synapse-logo-footer.png",  height: 60,  alt: "Synapse App" },
  mobile:    { src: "/images/synapse-icon-mobile.png",  height: 32,  alt: "Synapse" },
  compact:   { src: "/images/synapse-icon-sm.png",      height: 28,  alt: "Synapse" },
  watermark: { src: "/images/synapse-icon-watermark.png", height: 24, alt: "Synapse" },
};

interface SynapseLogoProps {
  variant: LogoVariant;
  className?: string;
}

export function SynapseLogo({ variant, className = "" }: SynapseLogoProps) {
  const { src, height, alt } = VARIANTS[variant];
  return (
    <img
      src={src}
      alt={alt}
      height={height}
      style={{ height: `${height}px`, width: "auto" }}
      className={`object-contain ${className}`}
      draggable={false}
    />
  );
}

/** Inline logo + text for places where we need the icon next to "Synapse" text */
export function SynapseLogoInline({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <SynapseLogo variant="mobile" />
      <span className="text-lg font-bold tracking-tight text-foreground">Synapse</span>
    </div>
  );
}
