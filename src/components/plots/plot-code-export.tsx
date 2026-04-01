"use client";

import { BracesIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";

import {
  buildPythonPlotCode,
  buildRPlotCode,
  type PlotExportSpec,
} from "@/lib/plot-code-export";
import { Button } from "@/components/ui/button";

type PlotCodeExportProps = {
  spec: PlotExportSpec;
  className?: string;
};

async function copyText(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const tempArea = document.createElement("textarea");
  tempArea.value = value;
  tempArea.style.position = "fixed";
  tempArea.style.opacity = "0";
  document.body.appendChild(tempArea);
  tempArea.focus();
  tempArea.select();
  document.execCommand("copy");
  document.body.removeChild(tempArea);
}

export function PlotCodeExport({ spec, className }: PlotCodeExportProps) {
  const copyPython = async () => {
    try {
      await copyText(buildPythonPlotCode(spec));
      toast.success("Python kodu panoya kopyalandı.");
    } catch {
      toast.error("Python kodu kopyalanamadı.");
    }
  };

  const copyR = async () => {
    try {
      await copyText(buildRPlotCode(spec));
      toast.success("R kodu panoya kopyalandı.");
    } catch {
      toast.error("R kodu kopyalanamadı.");
    }
  };

  return (
    <div className={["mt-3 flex flex-wrap items-center gap-2", className ?? ""].join(" ")}>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <BracesIcon className="size-3.5" />
        Export Code
      </span>
      <Button type="button" variant="outline" size="sm" onClick={() => void copyPython()}>
        <CopyIcon className="mr-1.5 size-3.5" />
        Python (Pandas + Plotly)
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => void copyR()}>
        <CopyIcon className="mr-1.5 size-3.5" />
        R (ggplot2)
      </Button>
    </div>
  );
}
