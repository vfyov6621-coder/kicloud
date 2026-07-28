"use client";

/**
 * TCloud — GlassPanel
 * ТЗ 3.4.1: базовый компонент для всех панелей, карточек, сайдбара, модальных.
 * Многослойность: полупрозрачный фон + blur + световая граница + мягкая тень.
 */

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "strong";
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          variant === "strong" ? "glass-panel-strong" : "glass-panel",
          className
        )}
        {...props}
      />
    );
  }
);

GlassPanel.displayName = "GlassPanel";
