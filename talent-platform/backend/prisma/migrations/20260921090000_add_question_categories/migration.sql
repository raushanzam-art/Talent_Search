CREATE TABLE "QuestionCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "QuestionCategory_name_key" ON "QuestionCategory"("name");
CREATE INDEX "QuestionCategory_active_displayOrder_idx" ON "QuestionCategory"("active", "displayOrder");

ALTER TABLE "Question" ADD COLUMN "categoryId" TEXT REFERENCES "QuestionCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Question_categoryId_idx" ON "Question"("categoryId");

INSERT INTO "QuestionCategory" ("id", "name", "description", "displayOrder", "active", "updatedAt") VALUES
  ('primary', 'Primary', 'Primary-level questions', 1, true, CURRENT_TIMESTAMP),
  ('secondary', 'Secondary', 'Secondary-level questions', 2, true, CURRENT_TIMESTAMP),
  ('intermediate', 'Intermediate', 'Intermediate-level questions', 3, true, CURRENT_TIMESTAMP),
  ('professional', 'Professional', 'Professional-level questions', 4, true, CURRENT_TIMESTAMP),
  ('higher_level', 'Higher Level', 'Higher-level questions', 5, true, CURRENT_TIMESTAMP);
