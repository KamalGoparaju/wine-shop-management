const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

const seedAdminUser = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@wineshop.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    const adminName = process.env.ADMIN_NAME || 'System Admin';

    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await prisma.user.create({
        data: {
          email: adminEmail.toLowerCase().trim(),
          password: hashedPassword,
          name: adminName,
          role: 'ADMIN',
          isActive: true
        }
      });
      console.log(`[Auth Service Seed] Default admin created: ${adminEmail}`);
    } else {
      console.log(`[Auth Service Seed] Admin user already exists.`);
    }
  } catch (error) {
    console.error('[Auth Service Seed Error]:', error.message);
  }
};

module.exports = { seedAdminUser };
