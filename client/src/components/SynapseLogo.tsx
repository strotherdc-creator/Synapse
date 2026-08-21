interface SynapseLogoProps {
  variant?: "full" | "icon";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function SynapseLogo({ variant = "icon", size = "sm", className = "" }: SynapseLogoProps) {
  const heights: Record<string, string> = {
    sm: "h-6",
    md: "h-10",
    lg: "h-16",
  };

  const src = variant === "full"
    ? "/images/synapse-logo-full.png"
    : "/images/synapse-logo-icon.png";

  const alt = variant === "full" ? "Synapse App" : "Synapse";

  return (
    <img
      src={src}
      alt={alt}
      className={`${heights[size]} w-auto object-contain ${className}`}
    />
  );
}
