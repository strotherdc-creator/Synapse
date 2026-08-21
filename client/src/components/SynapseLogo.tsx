import { Zap } from "lucide-react";

interface SynapseLogoProps {
  size?: "sm" | "md";
  className?: string;
}

export function SynapseLogo({ size = "sm", className = "" }: SynapseLogoProps) {
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const textSize = size === "sm" ? "text-sm" : "text-base";

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Zap className={`${iconSize} text-gold`} />
      <span className={`${textSize} font-bold tracking-tight text-gold/80`}>
        Synapse
      </span>
    </div>
  );
}
