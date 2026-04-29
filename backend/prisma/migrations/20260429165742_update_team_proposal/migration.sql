/*
  Warnings:

  - You are about to drop the column `detailedSchedule` on the `team_proposals` table. All the data in the column will be lost.
  - You are about to drop the column `expectedDuration` on the `team_proposals` table. All the data in the column will be lost.
  - You are about to drop the column `projectType` on the `team_proposals` table. All the data in the column will be lost.
  - You are about to drop the column `teamName` on the `team_proposals` table. All the data in the column will be lost.
  - You are about to drop the column `techStack` on the `team_proposals` table. All the data in the column will be lost.
  - Added the required column `projectName` to the `team_proposals` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "team_proposals" DROP COLUMN "detailedSchedule",
DROP COLUMN "expectedDuration",
DROP COLUMN "projectType",
DROP COLUMN "teamName",
DROP COLUMN "techStack",
ADD COLUMN     "projectName" TEXT NOT NULL;
