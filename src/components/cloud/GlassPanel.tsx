"use client";

/**
 * kicloud — Panel
 * Базовый flat-компонент для всех панелей, карточек, сайдбара, модальных.
 */

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "muted";
}

export const GlassPanel = forwardRef<HTMLDivElement, PanelProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          variant === "muted" ? "surface-panel-muted" : "surface-panel",
          className
        )}
        {...props}
      />
    );
  }
);

GlassPanel.displayName = "GlassPanel";

// Alias для обратной совместимости
export const Panel = GlassPanel;
