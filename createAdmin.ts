import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createAdmin() {
  const email = 'nerdified.get@gmail.com';
  const password = 'SlyF0x@87';
  const name = 'Andy James';
  const role = 'SUPER';

  // Hash the password
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Create new admin
  const newAdmin = await prisma.admin.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role,
    },
  });

  console.log('New admin created:', newAdmin);
}

createAdmin()
  .catch((e) => {
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
