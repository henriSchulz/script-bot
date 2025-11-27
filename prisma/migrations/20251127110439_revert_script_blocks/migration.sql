/*
  Warnings:

  - You are about to drop the `ScriptBlock` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Project" ADD COLUMN "script" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ScriptBlock";
PRAGMA foreign_keys=on;
