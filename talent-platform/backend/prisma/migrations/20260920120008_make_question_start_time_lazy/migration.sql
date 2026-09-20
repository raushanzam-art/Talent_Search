-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AssessmentAttemptQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "questionStartedAt" DATETIME,
    "timeSpent" INTEGER NOT NULL DEFAULT 0,
    "timedOut" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AssessmentAttemptQuestion_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssessmentAttemptQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AssessmentAttemptQuestion" ("attemptId", "id", "position", "questionId", "questionStartedAt", "timeSpent", "timedOut") SELECT "attemptId", "id", "position", "questionId", "questionStartedAt", "timeSpent", "timedOut" FROM "AssessmentAttemptQuestion";
DROP TABLE "AssessmentAttemptQuestion";
ALTER TABLE "new_AssessmentAttemptQuestion" RENAME TO "AssessmentAttemptQuestion";
CREATE INDEX "AssessmentAttemptQuestion_attemptId_idx" ON "AssessmentAttemptQuestion"("attemptId");
CREATE INDEX "AssessmentAttemptQuestion_questionId_idx" ON "AssessmentAttemptQuestion"("questionId");
CREATE UNIQUE INDEX "AssessmentAttemptQuestion_attemptId_questionId_key" ON "AssessmentAttemptQuestion"("attemptId", "questionId");
CREATE UNIQUE INDEX "AssessmentAttemptQuestion_attemptId_position_key" ON "AssessmentAttemptQuestion"("attemptId", "position");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
