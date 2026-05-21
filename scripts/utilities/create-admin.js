#!/usr/bin/env node

/**
 * Create Admin User Script for Mugiwara-Kaizoku
 * This script creates an admin user for the application
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function questionHidden(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    let password = '';
    process.stdin.on('data', function(char) {
      char = char + '';
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003':
          process.exit();
          break;
        case '\u007f':
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    });
  });
}

async function createAdmin() {
  console.log('🔐 Mugiwara-Kaizoku Admin User Creation\n');

  try {
    // Check if any users exist
    const userCount = await prisma.user.count();
    
    if (userCount > 0) {
      console.log('ℹ️  Users already exist in the database.');
      const overwrite = await question('Do you want to create another admin user? (y/N): ');
      if (overwrite.toLowerCase() !== 'y') {
        console.log('✅ Admin creation cancelled.');
        process.exit(0);
      }
    }

    // Get user input
    const username = await question('👤 Enter admin username: ');
    if (!username || username.trim().length < 3) {
      console.log('❌ Username must be at least 3 characters long.');
      process.exit(1);
    }

    const email = await question('📧 Enter admin email: ');
    if (!email || !email.includes('@')) {
      console.log('❌ Please enter a valid email address.');
      process.exit(1);
    }

    const password = await questionHidden('🔑 Enter admin password: ');
    if (!password || password.length < 6) {
      console.log('❌ Password must be at least 6 characters long.');
      process.exit(1);
    }

    const confirmPassword = await questionHidden('🔑 Confirm admin password: ');
    if (password !== confirmPassword) {
      console.log('❌ Passwords do not match.');
      process.exit(1);
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: username.trim() }
    });

    if (existingUser) {
      console.log('❌ Username already exists. Please choose a different username.');
      process.exit(1);
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        username: username.trim(),
        email: email.trim(),
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
      }
    });

    console.log('\n✅ Admin user created successfully!');
    console.log(`   Username: ${adminUser.username}`);
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log('\n🚀 You can now log in to Mugiwara-Kaizoku at http://localhost:3000');

  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message);
    
    if (error.code === 'P2002') {
      console.log('   Username or email already exists.');
    } else if (error.code === 'P1001') {
      console.log('   Cannot connect to database. Make sure PostgreSQL is running.');
    } else {
      console.log('   Please check your database connection and try again.');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n\n👋 Admin creation cancelled.');
  await prisma.$disconnect();
  rl.close();
  process.exit(0);
});

// Run the script
createAdmin();
