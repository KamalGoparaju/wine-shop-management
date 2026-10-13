const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

const seedAdminUser = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@wineshop.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    const adminName = process.env.ADMIN_NAME || 'System Admin';

    // 1. Ensure 3 default shops exist
    const defaultShops = [
      { code: 'SHOP1', name: 'Shop 1 — Central Wine Lounge', address: 'Main Market Road, City Centre' },
      { code: 'SHOP2', name: 'Shop 2 — Premium Spirits & Wine', address: 'Station Road, West Hub' },
      { code: 'SHOP3', name: 'Shop 3 — Highway Wine Mart', address: 'National Highway 44, Express Junction' }
    ];

    const shops = [];
    for (const s of defaultShops) {
      let shop = await prisma.shop.findUnique({ where: { code: s.code } });
      if (!shop) {
        shop = await prisma.shop.create({
          data: {
            code: s.code,
            name: s.name,
            address: s.address,
            isActive: true
          }
        });
        console.log(`[Auth Service Seed] Created shop: ${shop.name} (${shop.code})`);
      }
      shops.push(shop);
    }

    // 2. Ensure admin user exists
    let admin = await prisma.user.findFirst({
      where: { email: adminEmail.toLowerCase().trim() }
    });

    if (!admin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      admin = await prisma.user.create({
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

    // 3. Ensure admin user is linked to all 3 shops
    for (const shop of shops) {
      const existingLink = await prisma.userShop.findUnique({
        where: {
          userId_shopId: {
            userId: admin.id,
            shopId: shop.id
          }
        }
      });

      if (!existingLink) {
        await prisma.userShop.create({
          data: {
            userId: admin.id,
            shopId: shop.id
          }
        });
        console.log(`[Auth Service Seed] Assigned ${admin.email} to shop ${shop.name}`);
      }
    }
  } catch (error) {
    console.error('[Auth Service Seed Error]:', error.message);
  }
};

module.exports = { seedAdminUser };
