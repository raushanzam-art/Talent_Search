import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const skills = [
  'Verbal Reasoning',
  'Numerical Reasoning',
  'Spatial Reasoning',
  'Non-Verbal Reasoning',
  'Reading Comprehension',
  'Logical Reasoning',
  'Problem Solving',
  'Analytical Thinking'
];

const expertiseLevels = [
  { name: 'Beginner', secondsPerQuestion: 28 },
  { name: 'Intermediate', secondsPerQuestion: 20 },
  { name: 'Expert', secondsPerQuestion: 12 }
];
const questionTypes = ['MULTIPLE_CHOICE', 'VERBAL', 'NUMERICAL', 'SPATIAL', 'NON_VERBAL', 'READING'];
const questionCategories = [
  { id: 'primary', name: 'Primary', description: 'Primary-level questions', displayOrder: 1 },
  { id: 'secondary', name: 'Secondary', description: 'Secondary-level questions', displayOrder: 2 },
  { id: 'intermediate', name: 'Intermediate', description: 'Intermediate-level questions', displayOrder: 3 },
  { id: 'professional', name: 'Professional', description: 'Professional-level questions', displayOrder: 4 },
  { id: 'higher_level', name: 'Higher Level', description: 'Higher-level questions', displayOrder: 5 }
];

async function seed(): Promise<void> {
  for (const name of skills) {
    await prisma.skill.upsert({
      where: { name },
      update: { active: true },
      create: { name }
    });
  }

  for (const level of expertiseLevels) {
    await prisma.expertiseLevel.upsert({
      where: { name: level.name },
      update: {
        secondsPerQuestion: level.secondsPerQuestion,
        active: true
      },
      create: level
    });
  }
  for (const name of questionTypes) {
    await prisma.questionType.upsert({ where: { name }, update: { active: true }, create: { name } });
  }
  for (const category of questionCategories) {
    await prisma.questionCategory.upsert({ where: { id: category.id }, update: { active: true }, create: category });
  }
}

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
