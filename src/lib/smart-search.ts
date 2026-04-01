"use client";

export type SmartSearchFilters = {
  raw: string;
  pValueLt: number | null;
  foldChangeGt: number | null;
  geneTerms: string[];
  geneQuery: string | null;
  hasRule: boolean;
};

const P_VALUE_REGEX = /p\s*<\s*(\d+\.?\d*)/i;
const FOLD_CHANGE_REGEX = /(?:fc|fold)\s*>\s*(\d+\.?\d*)/i;
const GENE_TAG_REGEX = /gen\s*:\s*([A-Za-z0-9._-]+)/gi;
const TOKEN_REGEX = /[A-Za-z0-9._-]{2,}/g;

function toNumber(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export function parseSmartSearchQuery(query: string): SmartSearchFilters {
  const raw = query.trim();
  const normalized = raw.replace(/\s+/g, " ");

  const pMatch = normalized.match(P_VALUE_REGEX);
  const foldMatch = normalized.match(FOLD_CHANGE_REGEX);

  const explicitGeneTerms: string[] = [];
  for (const match of normalized.matchAll(GENE_TAG_REGEX)) {
    const token = match[1]?.trim().toUpperCase();
    if (token && !explicitGeneTerms.includes(token)) {
      explicitGeneTerms.push(token);
    }
  }

  const stripped = normalized
    .replace(P_VALUE_REGEX, " ")
    .replace(FOLD_CHANGE_REGEX, " ")
    .replace(GENE_TAG_REGEX, " ");

  const ignored = new Set(["P", "FC", "FOLD", "GEN"]);
  const tokenTerms = (stripped.match(TOKEN_REGEX) ?? [])
    .map((token) => token.toUpperCase())
    .filter((token) => !ignored.has(token));

  const geneTerms = [...explicitGeneTerms];
  for (const token of tokenTerms) {
    if (!geneTerms.includes(token)) {
      geneTerms.push(token);
    }
  }

  const pValueLt = toNumber(pMatch?.[1]) ?? null;
  const foldChangeGt = Math.abs(toNumber(foldMatch?.[1]) ?? 0) || null;

  return {
    raw,
    pValueLt,
    foldChangeGt,
    geneTerms,
    geneQuery: geneTerms[0] ?? null,
    hasRule: Boolean(pMatch || foldMatch || explicitGeneTerms.length),
  };
}

export function buildDifferentialExpressionSearchParams(filters: SmartSearchFilters) {
  const params = new URLSearchParams();

  if (filters.geneQuery) {
    params.set("gene", filters.geneQuery);
  }
  if (filters.pValueLt !== null) {
    params.set("pMax", String(filters.pValueLt));
  }
  if (filters.foldChangeGt !== null) {
    params.set("fcMin", String(filters.foldChangeGt));
  }
  if (filters.raw) {
    params.set("q", filters.raw);
  }

  return params;
}

