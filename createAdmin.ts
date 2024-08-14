import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const NAME = process.env.ADMIN_NAME;

async function createAdmin() {
  const email = EMAIL;
  const password = PASSWORD;
  const name = NAME;
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
