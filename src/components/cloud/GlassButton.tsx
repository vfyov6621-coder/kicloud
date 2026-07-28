"use client";

/**
 * TCloud — GlassButton
 * ТЗ 3.4.2: Primary (заливка, scale 0.97) и Ghost (прозрачный).
 * Touch target 44px minimum (Apple HIG).
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
          variant === "primary" ? "glass-button-primary" : "glass-button-ghost",
          size === "sm" && "text-sm px-3 py-2 min-h-[36px]",
          size === "md" && "text-[15px] px-6 py-3 min-h-[44px]",
          size === "lg" && "text-base px-8 py-4 min-h-[52px]",
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
