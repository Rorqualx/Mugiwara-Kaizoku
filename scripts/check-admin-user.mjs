#!/usr/bin/env node

/**
 * Script to check and verify admin user in database
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkAdminUser() {
  try {
    console.log('🔍 Checking for admin users in database...\n');
    
    // Check all users
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });
    
    console.log(`📊 Total users in database: ${allUsers.length}`);
    
    if (allUsers.length > 0) {
      console.log('\n👥 Users found:');
      allUsers.forEach(user => {
        console.log(`  - ${user.email} (${user.name || 'No name'}) - Role: ${user.role || 'USER'}`);
        console.log(`    ID: ${user.id}, Created: ${user.createdAt.toISOString()}`);
      });
    } else {
      console.log('  No users found in database!');
    }
    
    // Check specifically for admin emails
    const adminEmails = [
      'admin@kaizoku.dev',
      'admin@kaizoku.local',
      'admin@localhost'
    ];
    
    console.log('\n🔍 Checking for common admin emails:');
    for (const email of adminEmails) {
      const user = await prisma.user.findUnique({
        where: { email }
      });
      
      if (user) {
        console.log(`  ✅ Found: ${email} (ID: ${user.id})`);
        
        // Check if password is set
        if (user.hashedPassword) {
          // Test if default password works
          const defaultPasswords = ['admin123', 'admin', 'password', 'kaizoku'];
          console.log(`    Testing default passwords...`);
          
          for (const pwd of defaultPasswords) {
            const matches = await bcrypt.compare(pwd, user.hashedPassword);
            if (matches) {
              console.log(`    ✅ Password "${pwd}" works!`);
              break;
            }
          }
        } else {
          console.log(`    ⚠️  No password set for this user`);
        }
      } else {
        console.log(`  ❌ Not found: ${email}`);
      }
    }
    
    // Check for any admin role users
    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN' }
    });
    
    console.log(`\n👑 Users with ADMIN role: ${adminUsers.length}`);
    if (adminUsers.length > 0) {
      adminUsers.forEach(user => {
        console.log(`  - ${user.email} (${user.name || 'No name'})`);
      });
    }
    
    // Check Account table (NextAuth)
    const accounts = await prisma.account.count();
    console.log(`\n🔗 NextAuth accounts: ${accounts}`);
    
    console.log('\n✅ Check complete!');
    
  } catch (error) {
    console.error('❌ Error checking users:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkAdminUser();