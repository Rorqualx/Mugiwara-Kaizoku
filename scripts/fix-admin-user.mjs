#!/usr/bin/env node

/**
 * Script to fix admin user - set password or create new admin
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function fixAdminUser() {
  try {
    console.log('🔧 Fixing admin user...\n');
    
    // First, try to fix the existing admin@kaizoku.local user
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@kaizoku.local' }
    });
    
    if (existingAdmin) {
      console.log('📧 Found existing admin: admin@kaizoku.local');
      
      // Hash the default password
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      // Update the user with password
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          hashedPassword: hashedPassword,
          name: 'Admin',
          userName: existingAdmin.userName || 'admin'
        }
      });
      
      console.log('✅ Updated admin@kaizoku.local with password: admin123');
    }
    
    // Also create the expected admin@kaizoku.dev user
    const expectedAdmin = await prisma.user.findUnique({
      where: { email: 'admin@kaizoku.dev' }
    });
    
    if (!expectedAdmin) {
      console.log('\n📧 Creating admin@kaizoku.dev user...');
      
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await prisma.user.create({
        data: {
          email: 'admin@kaizoku.dev',
          name: 'Admin Dev',
          userName: 'admindev',
          hashedPassword: hashedPassword,
          role: 'ADMIN'
        }
      });
      
      console.log('✅ Created admin@kaizoku.dev with password: admin123');
    } else {
      console.log('✅ admin@kaizoku.dev already exists');
      
      // Make sure it has a password
      if (!expectedAdmin.hashedPassword) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await prisma.user.update({
          where: { id: expectedAdmin.id },
          data: { 
            hashedPassword: hashedPassword,
            userName: expectedAdmin.userName || 'admin'
          }
        });
        console.log('✅ Set password for admin@kaizoku.dev: admin123');
      }
    }
    
    // List all admin users
    console.log('\n📋 Admin users in database:');
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        email: true,
        name: true,
        hashedPassword: true,
        userName: true
      }
    });
    
    admins.forEach(admin => {
      console.log(`  ✅ ${admin.email} (username: ${admin.userName}) - Password set: ${admin.hashedPassword ? 'Yes' : 'No'}`);
    });
    
    console.log('\n🎉 Admin users fixed!');
    console.log('\n🔑 You can now login with:');
    console.log('  Email: admin@kaizoku.dev');
    console.log('  Password: admin123');
    console.log('\n  OR');
    console.log('\n  Email: admin@kaizoku.local');
    console.log('  Password: admin123');
    
  } catch (error) {
    console.error('❌ Error fixing admin user:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixAdminUser();