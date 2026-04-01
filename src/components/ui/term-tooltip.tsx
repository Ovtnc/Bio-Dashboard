"use client";

import { CircleHelpIcon } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type TermTooltipProps = {
  label?: string;
  description: string;
  className?: string;
  iconOnly?: boolean;
};

export function TermTooltip({ label, description, className, iconOnly = false }: TermTooltipProps) {
  const safeLabel = label?.trim() || "Teknik terim";

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {!iconOnly ? <span>{safeLabel}</span> : null}
      <TooltipProvider delay={120} closeDelay={80}>
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                role="button"
                tabIndex={0}
                aria-label={`${safeLabel} açıklaması`}
              />
            }
          >
            <CircleHelpIcon className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>{description}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}
