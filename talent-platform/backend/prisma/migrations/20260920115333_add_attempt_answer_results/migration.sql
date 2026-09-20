-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AssessmentAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "score" INTEGER NOT NULL DEFAULT 0,
    "maxScore" INTEGER NOT NULL DEFAULT 0,
    "percentage" REAL,
    "answeredCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    CONSTRAINT "AssessmentAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssessmentAttempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AssessmentAttempt" ("assessmentId", "completedAt", "id", "maxScore", "score", "startedAt", "status", "userId") SELECT "assessmentId", "completedAt", "id", "maxScore", "score", "startedAt", "status", "userId" FROM "AssessmentAttempt";
DROP TABLE "AssessmentAttempt";
ALTER TABLE "new_AssessmentAttempt" RENAME TO "AssessmentAttempt";
CREATE INDEX "AssessmentAttempt_userId_idx" ON "AssessmentAttempt"("userId");
CREATE INDEX "AssessmentAttempt_assessmentId_idx" ON "AssessmentAttempt"("assessmentId");
CREATE INDEX "AssessmentAttempt_status_idx" ON "AssessmentAttempt"("status");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
