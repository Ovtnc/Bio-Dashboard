export const IGV_SUPPORTED_EXTENSIONS = [
  ".bam",
  ".vcf",
  ".bed",
  ".gff",
  ".gff3",
  ".gtf",
  ".bigwig",
  ".wig",
  ".bedgraph",
] as const;

export type SupportedIgvExtension = (typeof IGV_SUPPORTED_EXTENSIONS)[number];

export type IgvTrackDefinition = {
  extension: SupportedIgvExtension;
  type: "alignment" | "variant" | "annotation" | "wig";
  format: string;
  requiresIndex: boolean;
};

const EXTENSION_ALIASES: Record<string, SupportedIgvExtension> = {
  ".bigwig": ".bigwig",
  ".bw": ".bigwig",
  ".vcf.gz": ".vcf",
};

export function normalizeIgvExtension(
  fileName: string,
  fileType?: string
): SupportedIgvExtension | null {
  const normalizedName = fileName.trim().toLowerCase();
  const normalizedType = (fileType ?? "").trim().toLowerCase();

  const multiPartCandidates = [".vcf.gz", ".bigwig"];
  for (const ext of multiPartCandidates) {
    if (normalizedName.endsWith(ext) || normalizedType === ext) {
      return (EXTENSION_ALIASES[ext] ?? ext) as SupportedIgvExtension;
    }
  }

  const fromName = normalizedName.includes(".")
    ? `.${normalizedName.split(".").pop() ?? ""}`
    : "";
  const fromType = normalizedType.startsWith(".")
    ? normalizedType
    : normalizedType
      ? `.${normalizedType}`
      : "";

  const candidates = [fromType, fromName];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const aliased = EXTENSION_ALIASES[candidate] ?? candidate;
    if (IGV_SUPPORTED_EXTENSIONS.includes(aliased as SupportedIgvExtension)) {
      return aliased as SupportedIgvExtension;
    }
  }

  return null;
}

export function resolveIgvTrackDefinition(
  fileName: string,
  fileType?: string
): IgvTrackDefinition | null {
  const extension = normalizeIgvExtension(fileName, fileType);
  if (!extension) {
    return null;
  }

  if (extension === ".bam") {
    return {
      extension,
      type: "alignment",
      format: "bam",
      requiresIndex: true,
    };
  }

  if (extension === ".vcf") {
    return {
      extension,
      type: "variant",
      format: "vcf",
      requiresIndex: true,
    };
  }

  if (extension === ".bed" || extension === ".gff" || extension === ".gff3" || extension === ".gtf") {
    return {
      extension,
      type: "annotation",
      format: extension.slice(1),
      requiresIndex: false,
    };
  }

  return {
    extension,
    type: "wig",
    format: extension.slice(1),
    requiresIndex: false,
  };
}

export function isIgvSupportedFile(fileName: string, fileType?: string) {
  return resolveIgvTrackDefinition(fileName, fileType) !== null;
}
