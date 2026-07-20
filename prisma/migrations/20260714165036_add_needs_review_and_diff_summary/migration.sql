-- AlterEnum
ALTER TYPE "RuleStatus" ADD VALUE 'NEEDS_REVIEW';

-- AlterTable
ALTER TABLE "Guide" ADD COLUMN     "diffSummary" JSONB;
