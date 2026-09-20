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