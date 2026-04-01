"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const GENE_BASKET_STORAGE_KEY = "bio-dash.gene-basket.v1";

export type GeneBasketItem = {
  geneId: string;
  analysisId?: number | null;
  source?: string;
  addedAt: string;
};

type AddGenePayload = {
  geneId: string;
  analysisId?: number | null;
  source?: string;
};

type CreateBasketOptions = {
  analysisId?: number | null;
  source?: string;
};

type GeneBasketContextValue = {
  items: GeneBasketItem[];
  addGene: (payload: AddGenePayload) => void;
  removeGene: (geneId: string) => void;
  toggleGene: (payload: AddGenePayload) => void;
  createBasket: (genes: string[], options?: CreateBasketOptions) => void;
  clear: () => void;
  hasGene: (geneId: string) => boolean;
};

const GeneBasketContext = createContext<GeneBasketContextValue | null>(null);

function normalizeGene(geneId: string) {
  return geneId.trim().toUpperCase();
}

function readPersistedBasket(): GeneBasketItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(GENE_BASKET_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as GeneBasketItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => ({
        geneId: normalizeGene(String(item.geneId ?? "")),
        analysisId:
          typeof item.analysisId === "number" && Number.isFinite(item.analysisId)
            ? Math.trunc(item.analysisId)
            : null,
        source: item.source ? String(item.source) : undefined,
        addedAt: item.addedAt ? String(item.addedAt) : new Date().toISOString(),
      }))
      .filter((item) => item.geneId.length > 0);
  } catch {
    return [];
  }
}

export function GeneBasketProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<GeneBasketItem[]>(() => readPersistedBasket());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(GENE_BASKET_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addGene = useCallback((payload: AddGenePayload) => {
    const normalizedGene = normalizeGene(payload.geneId);
    if (!normalizedGene) {
      return;
    }

    setItems((previous) => {
      if (previous.some((item) => item.geneId === normalizedGene)) {
        return previous;
      }

      return [
        {
          geneId: normalizedGene,
          analysisId:
            typeof payload.analysisId === "number" && Number.isFinite(payload.analysisId)
              ? Math.trunc(payload.analysisId)
              : null,
          source: payload.source,
          addedAt: new Date().toISOString(),
        },
        ...previous,
      ];
    });
  }, []);

  const removeGene = useCallback((geneId: string) => {
    const normalizedGene = normalizeGene(geneId);
    if (!normalizedGene) {
      return;
    }
    setItems((previous) => previous.filter((item) => item.geneId !== normalizedGene));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  const createBasket = useCallback(
    (genes: string[], options?: CreateBasketOptions) => {
      const normalizedUniqueGenes = Array.from(
        new Set(genes.map((gene) => normalizeGene(String(gene ?? ""))).filter(Boolean))
      );

      setItems(
        normalizedUniqueGenes.map((geneId) => ({
          geneId,
          analysisId:
            typeof options?.analysisId === "number" && Number.isFinite(options.analysisId)
              ? Math.trunc(options.analysisId)
              : null,
          source: options?.source,
          addedAt: new Date().toISOString(),
        }))
      );
    },
    []
  );

  const hasGene = useCallback(
    (geneId: string) => {
      const normalizedGene = normalizeGene(geneId);
      if (!normalizedGene) {
        return false;
      }
      return items.some((item) => item.geneId === normalizedGene);
    },
    [items]
  );

  const toggleGene = useCallback(
    (payload: AddGenePayload) => {
      const normalizedGene = normalizeGene(payload.geneId);
      if (!normalizedGene) {
        return;
      }

      setItems((previous) => {
        const exists = previous.some((item) => item.geneId === normalizedGene);
        if (exists) {
          return previous.filter((item) => item.geneId !== normalizedGene);
        }

        return [
          {
            geneId: normalizedGene,
            analysisId:
              typeof payload.analysisId === "number" && Number.isFinite(payload.analysisId)
                ? Math.trunc(payload.analysisId)
                : null,
            source: payload.source,
            addedAt: new Date().toISOString(),
          },
          ...previous,
        ];
      });
    },
    []
  );

  const value = useMemo<GeneBasketContextValue>(
    () => ({
      items,
      addGene,
      removeGene,
      toggleGene,
      createBasket,
      clear,
      hasGene,
    }),
    [addGene, clear, createBasket, hasGene, items, removeGene, toggleGene]
  );

  return <GeneBasketContext.Provider value={value}>{children}</GeneBasketContext.Provider>;
}

export function useGeneBasket() {
  const context = useContext(GeneBasketContext);
  if (!context) {
    throw new Error("useGeneBasket must be used within GeneBasketProvider");
  }
  return context;
}
