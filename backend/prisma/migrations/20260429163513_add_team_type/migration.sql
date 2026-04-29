/*
  Warnings:

  - Added the required column `teamType` to the `teams` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TeamType" AS ENUM ('STUDY', 'COMPETITION', 'HACKATHON', 'PROJECT');

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "teamType" "TeamType" NOT NULL;
