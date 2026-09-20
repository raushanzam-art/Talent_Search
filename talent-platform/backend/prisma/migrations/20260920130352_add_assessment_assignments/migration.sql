-- CreateTable
CREATE TABLE "AssessmentAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssessmentAssignment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AssessmentAssignment_userId_idx" ON "AssessmentAssignment"("userId");

-- CreateIndex
CREATE INDEX "AssessmentAssignment_assessmentId_idx" ON "AssessmentAssignment"("assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentAssignment_status_idx" ON "AssessmentAssignment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAssignment_userId_assessmentId_key" ON "AssessmentAssignment"("userId", "assessmentId");
