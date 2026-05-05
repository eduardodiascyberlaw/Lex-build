/*
  Warnings:

  - You are about to drop the column `outputS3Key` on the `Peca` table. All the data in the column will be lost.
  - You are about to drop the column `s3Key` on the `PecaUpload` table. All the data in the column will be lost.
  - You are about to drop the column `s3Key` on the `Template` table. All the data in the column will be lost.
  - Added the required column `bytes` to the `PecaUpload` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bytes` to the `Template` table without a default value. This is not possible if the table is not empty.
  - Added the required column `filename` to the `Template` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Peca" DROP COLUMN "outputS3Key",
ADD COLUMN     "outputBytes" BYTEA,
ADD COLUMN     "outputFilename" TEXT,
ADD COLUMN     "outputMimeType" TEXT;

-- AlterTable
ALTER TABLE "PecaUpload" DROP COLUMN "s3Key",
ADD COLUMN     "bytes" BYTEA NOT NULL,
ADD COLUMN     "size" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Template" DROP COLUMN "s3Key",
ADD COLUMN     "bytes" BYTEA NOT NULL,
ADD COLUMN     "filename" TEXT NOT NULL,
ADD COLUMN     "mimeType" TEXT NOT NULL DEFAULT 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
