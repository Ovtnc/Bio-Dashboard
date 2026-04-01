/* eslint-disable @typescript-eslint/no-require-imports */
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.analysis.deleteMany();
  await prisma.file.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      email: "okan@example.com",
      name: "Okan Vatanci",
      role: "Senior Bioinformatician",
      image: "https://i.pravatar.cc/160?img=12",
      passwordHash: bcrypt.hashSync("BioDash123!", 10),
    },
  });

  const projectOne = await prisma.project.create({
    data: {
      name: "Human Genome Cohort A",
      description: "RNA-Seq karşılaştırmalı ifade analizi",
      userId: user.id,
      files: {
        create: [
          {
            name: "human_genome_v38.fasta",
            size: BigInt(3245632487),
            type: ".fasta",
            path: "/data/genomes/human_genome_v38.fasta",
          },
          {
            name: "cohort_a_variants.vcf",
            size: BigInt(145938442),
            type: ".vcf",
            path: "/data/variants/cohort_a_variants.vcf",
          },
        ],
      },
    },
  });

  const projectTwo = await prisma.project.create({
    data: {
      name: "Onco Panel Validation",
      description: "DNA-Seq panel doğrulama ve varyant kalite kontrolü",
      userId: user.id,
      files: {
        create: [
          {
            name: "tumor_alignment_047.bam",
            size: BigInt(812439551),
            type: ".bam",
            path: "/data/alignment/tumor_alignment_047.bam",
          },
        ],
      },
    },
  });

  await prisma.analysis.createMany({
    data: [
      {
        type: "RNA_SEQ",
        status: "COMPLETED",
        currentStep: "Completed",
        progress: 100,
        result: {
          sampleId: "Sample_A001",
          significantGenes: 312,
          topGenes: ["TP53", "BRCA1", "GAPDH"],
          completedAt: new Date().toISOString(),
        },
        projectId: projectOne.id,
      },
      {
        type: "RNA_SEQ",
        status: "COMPLETED",
        currentStep: "Completed",
        progress: 100,
        result: {
          sampleId: "Sample_A002",
          significantGenes: 281,
          topGenes: ["MYC", "EGFR", "PTEN"],
          completedAt: new Date().toISOString(),
        },
        projectId: projectOne.id,
      },
      {
        type: "DNA_SEQ",
        status: "RUNNING",
        currentStep: "Alignment",
        progress: 65,
        result: {
          sampleId: "Onco_047",
          stage: "Alignment",
          progress: 65,
          updatedAt: new Date().toISOString(),
        },
        projectId: projectTwo.id,
      },
      {
        type: "DNA_SEQ",
        status: "PENDING",
        currentStep: "Queued",
        progress: 0,
        result: {
          sampleId: "Onco_048",
          queuedAt: new Date().toISOString(),
        },
        projectId: projectTwo.id,
      },
      {
        type: "RNA_SEQ",
        status: "COMPLETED",
        currentStep: "Completed",
        progress: 100,
        result: {
          sampleId: "Sample_A003",
          significantGenes: 199,
          topGenes: ["CDK2", "RB1", "SMAD4"],
          completedAt: new Date().toISOString(),
        },
        projectId: projectOne.id,
      },
    ],
  });

  console.log("Seed başarıyla tamamlandı.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
