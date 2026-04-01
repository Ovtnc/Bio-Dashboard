import type { DifferentialExpressionRow } from "@/hooks/useBioData";

export type GoCategory = "Biological Process" | "Molecular Function" | "Cellular Component";

export type GoTermRecord = {
  term: string;
  category: GoCategory;
  genes: string[];
};

export type EnrichmentRow = {
  term: string;
  category: GoCategory;
  hitCount: number;
  termSize: number;
  pValue: number;
  adjustedPValue: number;
  score: number;
  hitGenes: string[];
};

const GO_TERMS: GoTermRecord[] = [
  {
    term: "DNA damage response",
    category: "Biological Process",
    genes: ["TP53", "BRCA1", "BRCA2", "ATM", "CHEK2", "RAD51", "PTEN"],
  },
  {
    term: "Cell cycle checkpoint",
    category: "Biological Process",
    genes: ["TP53", "CDK1", "CDK2", "CCND1", "RB1", "MDM2", "E2F1"],
  },
  {
    term: "Apoptotic signaling pathway",
    category: "Biological Process",
    genes: ["TP53", "BAX", "BCL2", "CASP3", "CASP8", "FAS", "MYC"],
  },
  {
    term: "MAPK cascade",
    category: "Biological Process",
    genes: ["EGFR", "KRAS", "BRAF", "MAPK1", "MAPK3", "FGFR1", "PIK3CA"],
  },
  {
    term: "Immune response regulation",
    category: "Biological Process",
    genes: ["IL6", "TNF", "STAT3", "JAK2", "NFKB1", "HLA-DRA", "CD4"],
  },
  {
    term: "Transcription factor activity",
    category: "Molecular Function",
    genes: ["TP53", "MYC", "STAT3", "NFKB1", "HIF1A", "E2F1", "FOXO3"],
  },
  {
    term: "Protein kinase activity",
    category: "Molecular Function",
    genes: ["EGFR", "JAK2", "BRAF", "MAPK1", "PIK3CA", "AKT1", "CDK1"],
  },
  {
    term: "DNA binding",
    category: "Molecular Function",
    genes: ["TP53", "BRCA1", "BRCA2", "MYC", "RB1", "E2F1", "HIF1A"],
  },
  {
    term: "ATP binding",
    category: "Molecular Function",
    genes: ["EGFR", "AKT1", "JAK2", "CDK1", "CDK2", "MAPK1", "BRAF"],
  },
  {
    term: "Chromatin binding",
    category: "Molecular Function",
    genes: ["BRCA1", "BRCA2", "RB1", "MDM2", "PTEN", "RAD51", "CHEK2"],
  },
  {
    term: "Nucleus",
    category: "Cellular Component",
    genes: ["TP53", "BRCA1", "BRCA2", "MYC", "RB1", "STAT3", "E2F1"],
  },
  {
    term: "Plasma membrane",
    category: "Cellular Component",
    genes: ["EGFR", "FGFR1", "FAS", "IL6", "TNF", "CD4", "HLA-DRA"],
  },
  {
    term: "Cytosol",
    category: "Cellular Component",
    genes: ["AKT1", "MAPK1", "MAPK3", "KRAS", "BRAF", "PIK3CA", "PTEN"],
  },
  {
    term: "Mitochondrion",
    category: "Cellular Component",
    genes: ["BAX", "BCL2", "CASP3", "FOXO3", "HIF1A", "PTEN", "MYC"],
  },
  {
    term: "Chromosome region",
    category: "Cellular Component",
    genes: ["BRCA1", "BRCA2", "RAD51", "CHEK2", "ATM", "RB1", "TP53"],
  },
];

function combination(n: number, k: number): number {
  if (k < 0 || k > n) {
    return 0;
  }
  if (k === 0 || k === n) {
    return 1;
  }

  const effectiveK = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= effectiveK; i += 1) {
    result = (result * (n - effectiveK + i)) / i;
  }
  return result;
}

function hypergeometricUpperTail(
  populationSize: number,
  successInPopulation: number,
  sampleSize: number,
  observedSuccess: number
): number {
  const maxHits = Math.min(successInPopulation, sampleSize);
  const denominator = combination(populationSize, sampleSize);
  if (denominator === 0) {
    return 1;
  }

  let cumulative = 0;
  for (let i = observedSuccess; i <= maxHits; i += 1) {
    cumulative +=
      (combination(successInPopulation, i) *
        combination(populationSize - successInPopulation, sampleSize - i)) /
      denominator;
  }

  return Math.min(1, Math.max(cumulative, 0));
}

function benjaminiHochberg(values: number[]): number[] {
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
    adjusted[sorted[i].index] = Number(runningMin.toPrecision(6));
  }

  return adjusted;
}

function getSignificantGenes(rows: DifferentialExpressionRow[]) {
  return rows
    .filter((row) => row.adjustedPValue < 0.05)
    .map((row) => row.genId.toUpperCase());
}

export function computeFunctionalEnrichment(rows: DifferentialExpressionRow[]): EnrichmentRow[] {
  const significantGenes = Array.from(new Set(getSignificantGenes(rows)));
  if (significantGenes.length === 0) {
    return [];
  }

  const universeGenes = Array.from(
    new Set(GO_TERMS.flatMap((term) => term.genes.map((gene) => gene.toUpperCase())))
  );
  const populationSize = universeGenes.length;

  const rawRows = GO_TERMS.map((term) => {
    const termGeneSet = new Set(term.genes.map((gene) => gene.toUpperCase()));
    const hitGenes = significantGenes.filter((gene) => termGeneSet.has(gene));

    const pValue = hypergeometricUpperTail(
      populationSize,
      termGeneSet.size,
      significantGenes.length,
      hitGenes.length
    );

    return {
      term: term.term,
      category: term.category,
      hitCount: hitGenes.length,
      termSize: termGeneSet.size,
      pValue,
      hitGenes,
    };
  }).filter((row) => row.hitCount > 0);

  if (rawRows.length === 0) {
    return [];
  }

  const adjustedValues = benjaminiHochberg(rawRows.map((row) => row.pValue));

  return rawRows
    .map((row, index) => {
      const adjustedPValue = adjustedValues[index];
      return {
        ...row,
        adjustedPValue,
        score: -Math.log10(Math.max(adjustedPValue, 1e-12)),
      } satisfies EnrichmentRow;
    })
    .filter((row) => row.adjustedPValue < 0.05)
    .sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      if (a.adjustedPValue !== b.adjustedPValue) {
        return a.adjustedPValue - b.adjustedPValue;
      }
      return b.hitCount - a.hitCount;
    });
}

export function topTermsByCategory(rows: EnrichmentRow[], perCategory = 6) {
  const categories: GoCategory[] = [
    "Biological Process",
    "Molecular Function",
    "Cellular Component",
  ];

  const output: Record<GoCategory, EnrichmentRow[]> = {
    "Biological Process": [],
    "Molecular Function": [],
    "Cellular Component": [],
  };

  for (const category of categories) {
    output[category] = rows
      .filter((row) => row.category === category)
      .slice(0, perCategory);
  }

  return output;
}

export type NetworkNode = {
  id: string;
  label: string;
  log2FoldChange: number;
  pValue: number;
};

export type NetworkLink = {
  source: string;
  target: string;
  weight: number;
};

const KNOWN_INTERACTIONS: Array<[string, string, number]> = [
  ["TP53", "MDM2", 1],
  ["TP53", "BRCA1", 0.9],
  ["TP53", "RB1", 0.8],
  ["EGFR", "KRAS", 0.9],
  ["EGFR", "PIK3CA", 0.85],
  ["KRAS", "BRAF", 0.92],
  ["BRAF", "MAPK1", 0.88],
  ["MAPK1", "MAPK3", 0.9],
  ["IL6", "STAT3", 0.95],
  ["TNF", "NFKB1", 0.9],
  ["JAK2", "STAT3", 0.93],
  ["BRCA1", "RAD51", 0.94],
  ["BRCA2", "RAD51", 0.94],
  ["ATM", "CHEK2", 0.89],
  ["AKT1", "PTEN", 0.87],
  ["MYC", "E2F1", 0.86],
  ["CDK1", "CCND1", 0.82],
  ["BCL2", "BAX", 0.9],
  ["CASP8", "CASP3", 0.91],
  ["HIF1A", "VEGFA", 0.85],
];

export function buildInteractionNetwork(rows: DifferentialExpressionRow[], limit = 20): {
  nodes: NetworkNode[];
  links: NetworkLink[];
} {
  const topGenes = rows
    .slice()
    .sort((a, b) => {
      if (a.pValue !== b.pValue) {
        return a.pValue - b.pValue;
      }
      return Math.abs(b.log2FoldChange) - Math.abs(a.log2FoldChange);
    })
    .slice(0, limit)
    .map((row) => ({
      id: row.genId.toUpperCase(),
      label: row.genId.toUpperCase(),
      log2FoldChange: row.log2FoldChange,
      pValue: row.pValue,
    }));

  const nodeSet = new Set(topGenes.map((node) => node.id));
  const links: NetworkLink[] = [];

  for (const [source, target, weight] of KNOWN_INTERACTIONS) {
    if (nodeSet.has(source) && nodeSet.has(target)) {
      links.push({ source, target, weight });
    }
  }

  if (links.length === 0 && topGenes.length > 1) {
    for (let index = 0; index < topGenes.length - 1; index += 1) {
      links.push({
        source: topGenes[index].id,
        target: topGenes[index + 1].id,
        weight: 0.5,
      });
    }
  }

  return {
    nodes: topGenes,
    links,
  };
}
