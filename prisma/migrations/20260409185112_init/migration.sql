-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PecaType" AS ENUM ('ACPAD', 'CAUTELAR');

-- CreateEnum
CREATE TYPE "PecaStatus" AS ENUM ('DRAFT', 'PHASE_0_ACTIVE', 'PHASE_0_APPROVED', 'PHASE_1_ACTIVE', 'PHASE_1_APPROVED', 'PHASE_2_ACTIVE', 'PHASE_2_APPROVED', 'PHASE_3_ACTIVE', 'PHASE_3_APPROVED', 'PHASE_3_SKIPPED', 'PHASE_4_ACTIVE', 'PHASE_4_APPROVED', 'PHASE_5_ACTIVE', 'PHASE_5_APPROVED', 'GENERATING_DOCX', 'COMPLETED', 'ERROR');

-- CreateEnum
CREATE TYPE "PhaseStatus" AS ENUM ('PENDING', 'ACTIVE', 'APPROVED', 'SKIPPED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LegislationScope" AS ENUM ('CORE', 'MODULE');

-- CreateEnum
CREATE TYPE "NoteCategory" AS ENUM ('GENERAL', 'TRIBUNAL_SPECIFIC', 'PROCEDURAL', 'STRATEGIC');

-- CreateEnum
CREATE TYPE "StyleSection" AS ENUM ('PRESSUPOSTOS', 'FACTOS', 'TEMPESTIVIDADE', 'DIREITO', 'PEDIDOS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cpOA" TEXT NOT NULL,
    "firmName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "apiKeyEnc" TEXT,
    "model" TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    "role" "UserRole" NOT NULL DEFAULT 'USER',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Peca" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PecaType" NOT NULL,
    "status" "PecaStatus" NOT NULL,
    "currentPhase" INTEGER NOT NULL DEFAULT 0,
    "templateId" TEXT,
    "caseData" JSONB,
    "model" TEXT NOT NULL,
    "outputS3Key" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Peca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PecaUpload" (
    "id" TEXT NOT NULL,
    "pecaId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "textContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PecaUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Phase" (
    "id" TEXT NOT NULL,
    "pecaId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "PhaseStatus" NOT NULL,
    "content" TEXT,
    "originalContent" TEXT,
    "editedByUser" BOOLEAN NOT NULL DEFAULT false,
    "tokenInput" INTEGER,
    "tokenOutput" INTEGER,
    "startedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "Phase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "pecaId" TEXT NOT NULL,
    "phase" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThematicModule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pecaTypes" "PecaType"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThematicModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Legislation" (
    "id" TEXT NOT NULL,
    "diploma" TEXT NOT NULL,
    "article" TEXT NOT NULL,
    "epigraph" TEXT,
    "content" TEXT NOT NULL,
    "scope" "LegislationScope" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Legislation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleLegislation" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "legislationId" TEXT NOT NULL,
    "relevance" TEXT,

    CONSTRAINT "ModuleLegislation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleCoreRef" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "legislationId" TEXT NOT NULL,
    "context" TEXT,

    CONSTRAINT "ModuleCoreRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleJurisprudence" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "court" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "keyPassage" TEXT,
    "tags" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleJurisprudence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleDoctrine" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "work" TEXT NOT NULL,
    "passage" TEXT NOT NULL,
    "page" TEXT,
    "year" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleDoctrine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformNote" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "NoteCategory" NOT NULL DEFAULT 'GENERAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "NoteCategory" NOT NULL DEFAULT 'GENERAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StyleReference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pecaType" "PecaType" NOT NULL,
    "section" "StyleSection" NOT NULL,
    "beforeText" TEXT NOT NULL,
    "afterText" TEXT NOT NULL,
    "notes" TEXT,
    "isGoldStandard" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourcePecaId" TEXT,
    "sourcePhase" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StyleReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ThematicModule_code_key" ON "ThematicModule"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleLegislation_moduleId_legislationId_key" ON "ModuleLegislation"("moduleId", "legislationId");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleCoreRef_moduleId_legislationId_key" ON "ModuleCoreRef"("moduleId", "legislationId");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Peca" ADD CONSTRAINT "Peca_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PecaUpload" ADD CONSTRAINT "PecaUpload_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Phase" ADD CONSTRAINT "Phase_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleLegislation" ADD CONSTRAINT "ModuleLegislation_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "ThematicModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleLegislation" ADD CONSTRAINT "ModuleLegislation_legislationId_fkey" FOREIGN KEY ("legislationId") REFERENCES "Legislation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleCoreRef" ADD CONSTRAINT "ModuleCoreRef_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "ThematicModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleCoreRef" ADD CONSTRAINT "ModuleCoreRef_legislationId_fkey" FOREIGN KEY ("legislationId") REFERENCES "Legislation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleJurisprudence" ADD CONSTRAINT "ModuleJurisprudence_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "ThematicModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleDoctrine" ADD CONSTRAINT "ModuleDoctrine_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "ThematicModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformNote" ADD CONSTRAINT "PlatformNote_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "ThematicModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNote" ADD CONSTRAINT "UserNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNote" ADD CONSTRAINT "UserNote_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "ThematicModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StyleReference" ADD CONSTRAINT "StyleReference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
