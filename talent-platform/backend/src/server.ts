import 'dotenv/config';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app';

const environmentSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(32)
});

const environment = environmentSchema.parse(process.env);
const prisma = new PrismaClient();
const app = createApp(prisma, environment.JWT_SECRET);

app.listen(environment.PORT, () => {
  console.log(`Backend listening on http://localhost:${environment.PORT}`);
});
