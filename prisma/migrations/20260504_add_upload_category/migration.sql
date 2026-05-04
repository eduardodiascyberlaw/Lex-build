-- AlterTable: Add category column to PecaUpload
ALTER TABLE "PecaUpload" ADD COLUMN IF NOT EXISTS "category" TEXT;
