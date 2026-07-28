"use client";

/**
 * kicloud — Button
 * Primary (заливка) и Ghost (контур). Touch target 40px minimum.
 */

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          variant === "primary" ? "btn-primary" : "btn-ghost",
          size === "sm" && "text-xs px-3 py-2 min-h-[32px]",
          size === "md" && "text-sm px-5 py-2.5 min-h-[40px]",
          size === "lg" && "text-base px-8 py-4 min-h-[48px]",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

GlassButton.displayName = "GlassButton";

// Alias
export const Button = GlassButton;
