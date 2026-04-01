"use client";

export const GLOBAL_GENE_SEARCH_KEY = "bio-dash:gene-search";
export const GLOBAL_GENE_SEARCH_EVENT = "bio-dash:gene-search";

export type GeneSearchEventPayload = {
  gene: string;
};

export function normalizeGene(value: string) {
  return value.trim().toUpperCase();
}

export function readStoredGeneSearch() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(GLOBAL_GENE_SEARCH_KEY);
  if (!raw) {
    return null;
  }

  const normalized = normalizeGene(raw);
  return normalized || null;
}

export function broadcastGeneSearch(gene: string) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeGene(gene);
  if (!normalized) {
    return;
  }

  window.localStorage.setItem(GLOBAL_GENE_SEARCH_KEY, normalized);
  window.dispatchEvent(
    new CustomEvent<GeneSearchEventPayload>(GLOBAL_GENE_SEARCH_EVENT, {
      detail: { gene: normalized },
    })
  );
}
