import { z } from "zod";

const STATUS_VALUES = [
  "idle",
  "started",
  "processing",
  "completed",
  "failed",
] as const;

export const analysisStatusSchema = z.enum(STATUS_VALUES);

export const emailSchema = z
  .string()
  .trim()
  .min(1, "E-posta zorunludur.")
  .email("Geçerli bir e-posta adresi girin.")
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalıdır.")
  .max(128, "Şifre en fazla 128 karakter olabilir.");

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Ad Soyad en az 2 karakter olmalıdır.")
    .max(120, "Ad Soyad en fazla 120 karakter olabilir."),
  email: emailSchema,
  password: passwordSchema,
});

export const registerFormSchema = registerRequestSchema
  .extend({
    confirmPassword: passwordSchema,
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Şifreler eşleşmiyor.",
        path: ["confirmPassword"],
      });
    }
  });

export const registerResponseSchema = z.object({
  message: z.string(),
  user: z
    .object({
      id: z.number().int().positive(),
      name: z.string(),
      email: z.string().email(),
    })
    .optional(),
});

export const apiMessageResponseSchema = z.object({
  message: z.string(),
});

export const analysisStartRequestSchema = z.object({
  file_id: z
    .number()
    .int("file_id tam sayı olmalıdır.")
    .positive("file_id pozitif olmalıdır."),
  sample_id: z
    .string()
    .trim()
    .min(1, "sample_id boş olamaz.")
    .max(120, "sample_id en fazla 120 karakter olabilir.")
    .optional(),
});

export const analysisStartResponseSchema = z.object({
  job_id: z.string().min(1),
  status: z.literal("started"),
  task_id: z.string().optional(),
});

export const shareLinkResponseSchema = z.object({
  share_id: z.string().uuid(),
  analysis_id: z.number().int().positive(),
  readonly: z.boolean(),
  share_path: z.string(),
  api_path: z.string(),
  share_token: z.string().optional(),
  generated_at: z.string(),
});

export const publicSharePointSchema = z.object({
  genId: z.string(),
  log2FoldChange: z.number(),
  pValue: z.number().min(0).max(1),
  adjustedPValue: z.number().min(0).max(1),
  expressionLevel: z.number().int().nonnegative(),
});

export const publicSharePayloadSchema = z.object({
  share_id: z.string().uuid(),
  analysis_id: z.number().int().positive(),
  readonly: z.boolean(),
  generated_at: z.string(),
  report: z.object({
    title: z.string(),
    stage: z.string(),
    status: z.string(),
    updatedAt: z.string(),
    metrics: z.object({
      totalGenes: z.number().int().nonnegative(),
      significantGenes: z.number().int().nonnegative(),
      upRegulated: z.number().int().nonnegative(),
      downRegulated: z.number().int().nonnegative(),
    }),
    volcanoPoints: z.array(publicSharePointSchema),
    topFindings: z.array(publicSharePointSchema),
    methodology: z.record(z.string(), z.string()).optional().default({}),
  }),
});

export const significantGeneInputSchema = z.object({
  genId: z.string().trim().min(1).max(80),
  log2FoldChange: z.number().finite(),
  pValue: z.number().min(0).max(1),
  adjustedPValue: z.number().min(0).max(1).optional(),
  expressionLevel: z.number().nonnegative().optional(),
});

export const analysisInsightRequestSchema = z.object({
  significant_genes: z
    .array(significantGeneInputSchema)
    .min(1, "AI özet için en az 1 gen gereklidir.")
    .max(200, "AI özet için en fazla 200 gen gönderilebilir."),
});

export const analysisInsightResponseSchema = z.object({
  analysis_id: z.number().int().positive(),
  provider: z.enum(["local_kb", "openai", "fallback"]),
  model: z.string().nullable().optional(),
  markdown: z.string().min(1),
  significant_gene_count: z.number().int().nonnegative(),
  generated_at: z.string(),
  used_fallback: z.boolean().optional(),
  warning: z.string().nullable().optional(),
});

export const analysisNotebookResponseSchema = z.object({
  analysisId: z.number().int().positive(),
  notebookMarkdown: z.string(),
  updatedAt: z.string(),
});

export const analysisNotebookUpdateRequestSchema = z.object({
  markdown: z.string().max(200_000),
});

export const clinicalExecutiveFindingSchema = z.object({
  genId: z.string(),
  riskScore: z.number().min(1).max(10),
  riskLevel: z.enum(["critical", "high", "medium", "low"]),
  message: z.string(),
});

export const clinicalGeneInteractionSchema = z.object({
  genId: z.string(),
  log2FoldChange: z.number(),
  pValue: z.number().min(0).max(1),
  adjustedPValue: z.number().min(0).max(1),
  expressionLevel: z.number().int().nonnegative(),
  riskScore: z.number().min(1).max(10),
  riskLevel: z.enum(["critical", "high", "medium", "low"]),
  category: z.string().nullable().optional(),
  pathways: z.array(z.string()),
  associatedDiseases: z.array(z.string()),
  approvedDrugs: z.array(z.string()),
  potentialTherapies: z.array(z.string()),
  summary: z.string().nullable().optional(),
});

export const clinicalCohortComparisonSchema = z.object({
  genId: z.string(),
  currentExpression: z.number().int().nonnegative(),
  cohortValues: z.array(z.number().int().nonnegative()),
  cohortAverage: z.number().nonnegative(),
  cohortMedian: z.number().nonnegative(),
  percentile: z.number().min(0).max(100),
  sampleSize: z.number().int().nonnegative(),
});

export const clinicalSummaryResponseSchema = z.object({
  analysisId: z.number().int().positive(),
  generatedAt: z.string(),
  executiveSummary: z.array(clinicalExecutiveFindingSchema),
  geneInteractions: z.array(clinicalGeneInteractionSchema),
  cohortComparison: z.array(clinicalCohortComparisonSchema),
});

export const survivalCurvePointSchema = z.object({
  time: z.number().nonnegative(),
  survival: z.number().min(0).max(1),
  atRisk: z.number().int().nonnegative(),
  events: z.number().int().nonnegative(),
});

export const analysisSurvivalResponseSchema = z.object({
  analysisId: z.number().int().positive(),
  gene: z.string(),
  generatedAt: z.string(),
  groups: z.object({
    mutated: z.object({
      label: z.string(),
      sampleCount: z.number().int().nonnegative(),
      eventCount: z.number().int().nonnegative(),
      medianSurvivalMonths: z.number().nullable(),
      curve: z.array(survivalCurvePointSchema),
    }),
    wildType: z.object({
      label: z.string(),
      sampleCount: z.number().int().nonnegative(),
      eventCount: z.number().int().nonnegative(),
      medianSurvivalMonths: z.number().nullable(),
      curve: z.array(survivalCurvePointSchema),
    }),
  }),
  statistics: z.object({
    logRankPValue: z.number().min(0).max(1),
    hazardRatio: z.number().positive().nullable(),
    hazardRatioCiLow: z.number().positive().nullable(),
    hazardRatioCiHigh: z.number().positive().nullable(),
  }),
});

export const validationMethodologySchema = z.object({
  normalization: z.string(),
  statistical_test: z.string(),
  multiple_testing: z.string(),
  significance_rule: z.string(),
  reference_standard: z.string(),
});

export const validationReferenceHintSchema = z.object({
  expected: z.array(z.string()),
  basePath: z.string().nullable(),
});

export const analysisValidationResponseSchema = z.object({
  analysisId: z.number().int().positive(),
  status: z.enum(["verified", "benchmark_ready", "missing_reference", "insufficient_overlap"]),
  referenceTool: z.string(),
  referenceSource: z.string().nullable(),
  comparedGenes: z.number().int().nonnegative(),
  systemGenes: z.number().int().nonnegative(),
  referenceGenes: z.number().int().nonnegative(),
  concordancePercent: z.number().min(0).max(100),
  significanceAgreementPercent: z.number().min(0).max(100),
  directionAgreementPercent: z.number().min(0).max(100),
  rmseLog2FoldChange: z.number().nonnegative().nullable(),
  pearsonLog2FoldChange: z.number().min(-1).max(1).nullable(),
  isVerifiedScience: z.boolean(),
  verifiedThreshold: z.number().min(0).max(100),
  methodology: validationMethodologySchema,
  note: z.string(),
  referenceHint: validationReferenceHintSchema.optional(),
});

export const analysisStatusPayloadSchema = z.object({
  job_id: z.string().nullable().optional(),
  status: analysisStatusSchema.optional(),
  stage: z.string().optional(),
  progress: z
    .union([z.number(), z.string()])
    .optional()
    .transform((value) => {
      const numeric = Number(value ?? 0);
      if (!Number.isFinite(numeric)) {
        return 0;
      }

      return Math.max(0, Math.min(100, Math.round(numeric)));
    }),
  error: z.string().nullable().optional(),
});

export const workerStatusResponseSchema = z.object({
  generatedAt: z.string(),
  workersOnline: z.number().int().nonnegative(),
  workersTotal: z.number().int().nonnegative(),
  brokerError: z.string().nullable().optional(),
  queue: z.object({
    running: z.number().int().nonnegative(),
    queued: z.number().int().nonnegative(),
    activeTasks: z.number().int().nonnegative(),
    reservedTasks: z.number().int().nonnegative(),
    scheduledTasks: z.number().int().nonnegative(),
  }),
  errorRatePercent: z.number().min(0),
  analysisTotals: z.object({
    completed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }),
  workers: z.array(
    z.object({
      name: z.string(),
      online: z.boolean(),
      activeTasks: z.number().int().nonnegative(),
      reservedTasks: z.number().int().nonnegative(),
      scheduledTasks: z.number().int().nonnegative(),
      processedTasks: z.number().int().nonnegative(),
    })
  ),
});

export const uploadChunkResponseSchema = z.object({
  status: z.enum(["chunk_received", "completed"]),
  progress: z.number().int().min(0).max(100),
  fileId: z.number().int().positive().optional(),
  fileName: z.string().optional(),
  path: z.string().optional(),
  uploadId: z.string().optional(),
  chunkIndex: z.number().int().nonnegative().optional(),
  totalChunks: z.number().int().positive().optional(),
  receivedChunks: z.number().int().nonnegative().optional(),
});

export const uploadChunkRequestMetaSchema = z.object({
  chunkIndex: z.number().int().nonnegative(),
  totalChunks: z.number().int().positive(),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(50 * 1024 * 1024 * 1024),
});

export const smartSearchParsedSchema = z.object({
  raw: z.string(),
  normalized: z.string().optional(),
  pValueLt: z.number().nullable(),
  foldChangeGt: z.number().nullable(),
  geneTerms: z.array(z.string()),
  geneQuery: z.string().nullable(),
  hasRule: z.boolean(),
});

export const smartSearchResultSchema = z.object({
  analysisId: z.number().int().positive(),
  analysisStatus: z.string(),
  sampleId: z.string().nullable().optional(),
  updatedAt: z.string(),
  genId: z.string(),
  log2FoldChange: z.number(),
  pValue: z.number(),
  adjustedPValue: z.number().nullable().optional(),
  expressionLevel: z.number().nullable().optional(),
});

export const smartSearchResponseSchema = z.object({
  query: z.string(),
  parsed: smartSearchParsedSchema,
  totalMatches: z.number().int().nonnegative(),
  results: z.array(smartSearchResultSchema),
});

export const pathwayNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  matched: z.boolean(),
  regulation: z.enum(["up", "down", "neutral"]),
  log2FoldChange: z.number().nullable(),
  pValue: z.number().nullable(),
  adjustedPValue: z.number().nullable(),
  color: z.string(),
});

export const pathwayEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  interaction: z.string(),
});

export const pathwayOverlayResponseSchema = z.object({
  analysis_id: z.number().int().positive(),
  pathway: z.object({
    name: z.string(),
    slug: z.string(),
    description: z.string(),
  }),
  stats: z.object({
    matched: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    up: z.number().int().nonnegative(),
    down: z.number().int().nonnegative(),
    neutral: z.number().int().nonnegative(),
  }),
  elements: z.object({
    nodes: z.array(pathwayNodeSchema),
    edges: z.array(pathwayEdgeSchema),
  }),
});

export const drugMatchingRowSchema = z.object({
  gene: z.string(),
  mutation: z.string(),
  recommendedTherapy: z.string(),
  drug: z.string(),
  evidenceLevel: z.string(),
  referenceUrl: z.string(),
  log2FoldChange: z.number(),
  pValue: z.number().min(0).max(1),
  adjustedPValue: z.number().min(0).max(1),
});

export const drugMatchingResponseSchema = z.object({
  analysis_id: z.number().int().positive(),
  rows: z.array(drugMatchingRowSchema),
});

export const analysisMethodParameterSchema = z.object({
  key: z.string(),
  value: z.string(),
});

export const analysisMethodLibrarySchema = z.object({
  name: z.string(),
  version: z.string(),
});

export const analysisMethodsResponseSchema = z.object({
  analysis_id: z.number().int().positive(),
  generated_at: z.string(),
  analysis_type: z.string(),
  status: z.string(),
  current_step: z.string(),
  parameters: z.array(analysisMethodParameterSchema),
  methodology: z.record(z.string(), z.string()),
  python_libraries: z.array(analysisMethodLibrarySchema),
});

export const qcBaseCompositionItemSchema = z.object({
  base: z.enum(["A", "T", "G", "C", "N"]),
  count: z.number().int().nonnegative(),
  ratio: z.number().min(0).max(1),
});

export const qcDistributionPointSchema = z.object({
  gcPercent: z.number().min(0).max(100).optional(),
  length: z.number().int().nonnegative().optional(),
  frequency: z.number().int().nonnegative(),
});

export const qcPerTileSequenceQualitySchema = z.object({
  x: z.array(z.number().nonnegative()),
  y: z.array(z.string()),
  z: z.array(z.array(z.number().nonnegative())),
});

export const qcAdapterContentSeriesSchema = z.object({
  adapter: z.string(),
  positions: z.array(z.number().nonnegative()),
  values: z.array(z.number().min(0).max(100)),
});

export const qcAdapterContentSchema = z.object({
  series: z.array(qcAdapterContentSeriesSchema),
});

export const qcKmerProfileItemSchema = z.object({
  kmer: z.string().length(5),
  count: z.number().int().nonnegative(),
  ratio: z.number().min(0).max(1),
});

export const qcPerBaseQualityItemSchema = z.object({
  position: z.number().int().positive(),
  meanPhred: z.number().nonnegative(),
});

export const qcResponseSchema = z.object({
  file: z.object({
    id: z.number().int().positive(),
    name: z.string(),
    type: z.string(),
    path: z.string().optional(),
    createdAt: z.string(),
  }),
  generatedAt: z.string(),
  qc: z.object({
    format: z.enum(["fasta", "fastq"]),
    summary: z.object({
      readCount: z.number().int().nonnegative(),
      skippedReads: z.number().int().nonnegative().optional(),
      totalBases: z.number().int().nonnegative(),
      avgReadLength: z.number().nonnegative(),
      gcRatio: z.number().min(0).max(1),
      nRatio: z.number().min(0).max(1),
      duplicationRate: z.number().min(0).max(1).optional().default(0),
      overallQualityScore: z.number().int().min(0).max(100).optional().default(0),
      overall_quality_score: z.number().int().min(0).max(100).optional(),
    }),
    baseComposition: z.array(qcBaseCompositionItemSchema),
    gcDistribution: z.array(
      qcDistributionPointSchema.extend({
        gcPercent: z.number().min(0).max(100),
      })
    ),
    lengthDistribution: z.array(
      qcDistributionPointSchema.extend({
        length: z.number().int().nonnegative(),
      })
    ),
    perTileSequenceQuality: qcPerTileSequenceQualitySchema
      .optional()
      .default({ x: [], y: [], z: [] }),
    perBaseQuality: z.array(qcPerBaseQualityItemSchema).optional().default([]),
    adapterContent: qcAdapterContentSchema
      .optional()
      .default({ series: [] }),
    kmerProfile: z.array(qcKmerProfileItemSchema).optional().default([]),
  }),
});

export type LoginRequestInput = z.infer<typeof loginRequestSchema>;
export type RegisterRequestInput = z.infer<typeof registerRequestSchema>;
export type RegisterFormInput = z.infer<typeof registerFormSchema>;
export type AnalysisStartRequestInput = z.infer<typeof analysisStartRequestSchema>;
export type AnalysisInsightRequestInput = z.infer<typeof analysisInsightRequestSchema>;
export type AnalysisInsightResponse = z.infer<typeof analysisInsightResponseSchema>;
export type ShareLinkResponse = z.infer<typeof shareLinkResponseSchema>;
export type PublicSharePayload = z.infer<typeof publicSharePayloadSchema>;
export type ClinicalSummaryResponse = z.infer<typeof clinicalSummaryResponseSchema>;
export type AnalysisSurvivalResponse = z.infer<typeof analysisSurvivalResponseSchema>;
export type AnalysisValidationResponse = z.infer<typeof analysisValidationResponseSchema>;
export type AnalysisStatusPayload = {
  job_id: string | null;
  status: z.infer<typeof analysisStatusSchema>;
  stage: string;
  progress: number;
  error: string | null;
};
export type WorkerStatusResponse = z.infer<typeof workerStatusResponseSchema>;
export type UploadChunkResponse = z.infer<typeof uploadChunkResponseSchema>;
export type SmartSearchResult = z.infer<typeof smartSearchResultSchema>;
export type SmartSearchResponse = z.infer<typeof smartSearchResponseSchema>;
export type PathwayOverlayResponse = z.infer<typeof pathwayOverlayResponseSchema>;
export type DrugMatchingResponse = z.infer<typeof drugMatchingResponseSchema>;
export type AnalysisMethodsResponse = z.infer<typeof analysisMethodsResponseSchema>;
export type QcResponse = z.infer<typeof qcResponseSchema>;

export function parseAnalysisStatusPayload(
  payload: unknown,
  fallbackJobId: string | null = null
): AnalysisStatusPayload {
  const parsed = analysisStatusPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      job_id: fallbackJobId,
      status: fallbackJobId ? "processing" : "idle",
      stage: fallbackJobId ? "Queued" : "Idle",
      progress: 0,
      error: null,
    };
  }

  return {
    job_id: parsed.data.job_id ?? fallbackJobId,
    status: parsed.data.status ?? (fallbackJobId ? "processing" : "idle"),
    stage: parsed.data.stage ?? "Queued",
    progress: parsed.data.progress ?? 0,
    error: parsed.data.error ?? null,
  };
}
