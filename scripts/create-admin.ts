import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    // Test admin credentials
    const email = 'admin@nerdified.com';
    const password = 'Admin@123';
    const name = 'Admin User';
    const role: UserRole = 'SUPER_ADMIN';

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      console.log(`⚠️  Admin with email ${email} already exists!`);
      console.log('   Skipping creation.');
      return;
    }

    // Hash the password
    console.log('⏳ Creating admin account...');
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

    // Display success message with credentials
    console.log('\n✅ Admin account created successfully!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 ADMIN CREDENTIALS');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Name:     ${name}`);
    console.log(`Role:     ${role}`);
    console.log(`ID:       ${newAdmin.id}`);
    console.log('═══════════════════════════════════════════════════════\n');
  } catch (error: any) {
    console.error('\n❌ Error creating admin:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createAdmin();
