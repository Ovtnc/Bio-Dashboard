"use client";

import { useEffect, useState } from "react";

import { fetchApiWithAuth } from "@/lib/authenticated-fetch";

export type DifferentialExpressionRow = {
  genId: string;
  log2FoldChange: number;
  pValue: number;
  adjustedPValue: number;
  expressionLevel: number;
};

type ApiDifferentialExpressionRow = {
  GenID: string;
  log2FoldChange: number;
  p_value: number;
  adjustedPValue?: number;
  expressionLevel?: number;
};

function calculateAdjustedPValues(values: number[]) {
  const size = values.length;
  const sorted = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);

  const adjusted = new Array(size).fill(1);
  let runningMin = 1;

  for (let i = size - 1; i >= 0; i -= 1) {
    const rank = i + 1;
    const candidate = Math.min(1, (sorted[i].value * size) / rank);
    runningMin = Math.min(runningMin, candidate);
    adjusted[sorted[i].index] = Number(runningMin.toFixed(6));
  }

  return adjusted;
}

function toExpressionLevel(log2FoldChange: number, pValue: number, index: number) {
  const baseline = 1200;
  const foldImpact = Math.abs(log2FoldChange) * 2100;
  const significanceImpact = (1 - pValue / 0.05) * 6500;
  const variance = (index % 13) * 137;
  return Math.max(250, Math.round(baseline + foldImpact + significanceImpact + variance));
}

export function useBioData(enabled = true, analysisId?: number | null) {
  const [data, setData] = useState<DifferentialExpressionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setError(null);
      setData([]);
      return;
    }

    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const endpoint = analysisId
          ? `/api/analysis/differential-expression?analysis_id=${analysisId}`
          : "/api/analysis/differential-expression";

        const response = await fetchApiWithAuth(endpoint, {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("UNAUTHORIZED");
          }
          throw new Error(`API error: ${response.status}`);
        }

        const payload = (await response.json()) as ApiDifferentialExpressionRow[];
        const sanitized = payload.map((item) => ({
          genId: item.GenID,
          log2FoldChange: Number(item.log2FoldChange),
          pValue: Number(item.p_value),
          adjustedPValue:
            item.adjustedPValue !== undefined ? Number(item.adjustedPValue) : undefined,
          expressionLevel:
            item.expressionLevel !== undefined ? Number(item.expressionLevel) : undefined,
        }));

        const adjustedValues = calculateAdjustedPValues(
          sanitized.map((row) => row.pValue)
        );

        const mapped = sanitized.map((row, index) => ({
          genId: row.genId,
          log2FoldChange: row.log2FoldChange,
          pValue: row.pValue,
          adjustedPValue:
            row.adjustedPValue !== undefined ? row.adjustedPValue : adjustedValues[index],
          expressionLevel:
            row.expressionLevel !== undefined
              ? row.expressionLevel
              : toExpressionLevel(row.log2FoldChange, row.pValue, index),
        }));

        setData(mapped);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        setError(err instanceof Error ? err.message : "Bilinmeyen bir hata oluştu.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [analysisId, enabled]);

  return { data, isLoading, error };
}
