#!/usr/bin/env ts-node
/**
 * Script to generate test release data for calendar pattern detection
 * 
 * This script creates various release patterns (weekly, bi-weekly, monthly, irregular)
 * for testing the pattern detection algorithms.
 */

import { PrismaClient } from '@prisma/client';
import { subDays, subWeeks, subMonths, addDays, startOfMonth, endOfMonth } from 'date-fns';

const prisma = new PrismaClient();

interface TestPattern {
  name: string;
  mangaId: number;
  releaseType: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'IRREGULAR';
  generateDates: () => Date[];
}

/**
 * Generate weekly release dates (every Monday)
 */
function generateWeeklyDates(weeks: number = 20): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  
  for (let i = 0; i < weeks; i++) {
    const date = subWeeks(today, i);
    // Find the Monday of that week
    const dayOfWeek = date.getDay();
    const daysToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
    const monday = addDays(date, daysToMonday);
    
    // Add some variance (±1 day occasionally)
    const variance = Math.random() > 0.8 ? (Math.random() > 0.5 ? 1 : -1) : 0;
    dates.push(addDays(monday, variance));
  }
  
  return dates.reverse(); // Oldest first
}

/**
 * Generate bi-weekly release dates (every other Wednesday)
 */
function generateBiWeeklyDates(count: number = 10): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  
  for (let i = 0; i < count; i++) {
    const date = subWeeks(today, i * 2);
    // Find the Wednesday of that week
    const dayOfWeek = date.getDay();
    const daysToWednesday = (3 - dayOfWeek + 7) % 7;
    const wednesday = addDays(date, daysToWednesday);
    
    dates.push(wednesday);
  }
  
  return dates.reverse();
}

/**
 * Generate monthly release dates (15th of each month)
 */
function generateMonthlyDates(months: number = 12): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  
  for (let i = 0; i < months; i++) {
    const date = subMonths(today, i);
    // Set to 15th of the month
    date.setDate(15);
    
    // Add some variance (±2 days occasionally)
    const variance = Math.random() > 0.7 ? Math.floor(Math.random() * 5) - 2 : 0;
    dates.push(addDays(date, variance));
  }
  
  return dates.reverse();
}

/**
 * Generate end-of-month release dates
 */
function generateEndOfMonthDates(months: number = 12): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  
  for (let i = 0; i < months; i++) {
    const date = subMonths(today, i);
    const lastDay = endOfMonth(date);
    
    // Sometimes release a day or two early
    const variance = Math.random() > 0.7 ? -Math.floor(Math.random() * 3) : 0;
    dates.push(addDays(lastDay, variance));
  }
  
  return dates.reverse();
}

/**
 * Generate irregular release dates
 */
function generateIrregularDates(count: number = 15): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  let currentDate = subMonths(today, 6);
  
  for (let i = 0; i < count; i++) {
    // Random interval between 5 and 20 days
    const interval = Math.floor(Math.random() * 16) + 5;
    currentDate = addDays(currentDate, interval);
    
    if (currentDate < today) {
      dates.push(new Date(currentDate));
    }
  }
  
  return dates;
}

async function generateTestData() {
  console.log('🚀 Generating test calendar data...');
  
  try {
    // Get some existing manga to attach patterns to
    const manga = await prisma.manga.findMany({
      take: 5,
      where: {
        source: { not: null }
      }
    });
    
    if (manga.length === 0) {
      console.error('❌ No manga found in database. Please add some manga first.');
      return;
    }
    
    console.log(`📚 Found ${manga.length} manga to generate patterns for`);
    
    const testPatterns: TestPattern[] = [
      {
        name: 'Weekly Monday Release',
        mangaId: manga[0]?.id || 1,
        releaseType: 'WEEKLY',
        generateDates: () => generateWeeklyDates(20)
      },
      {
        name: 'Bi-Weekly Wednesday Release',
        mangaId: manga[1]?.id || 2,
        releaseType: 'BIWEEKLY',
        generateDates: () => generateBiWeeklyDates(10)
      },
      {
        name: 'Monthly 15th Release',
        mangaId: manga[2]?.id || 3,
        releaseType: 'MONTHLY',
        generateDates: () => generateMonthlyDates(12)
      },
      {
        name: 'End of Month Release',
        mangaId: manga[3]?.id || 4,
        releaseType: 'MONTHLY',
        generateDates: () => generateEndOfMonthDates(10)
      },
      {
        name: 'Irregular Release Pattern',
        mangaId: manga[4]?.id || 5,
        releaseType: 'IRREGULAR',
        generateDates: () => generateIrregularDates(15)
      }
    ];
    
    for (const pattern of testPatterns) {
      console.log(`\n📅 Generating ${pattern.name} for manga ID ${pattern.mangaId}`);
      
      // Clear existing release history for this manga
      await prisma.releaseHistory.deleteMany({
        where: { mangaId: pattern.mangaId }
      });
      
      // Clear existing release schedule
      await prisma.releaseSchedule.deleteMany({
        where: { mangaId: pattern.mangaId }
      });
      
      const dates = pattern.generateDates();
      console.log(`   Generated ${dates.length} release dates`);
      
      // Create release history entries
      for (const date of dates) {
        const chapterNumber = dates.indexOf(date) + 1;
        
        await prisma.releaseHistory.create({
          data: {
            mangaId: pattern.mangaId,
            chapterNumber: chapterNumber.toString(),
            releaseDate: date,
            source: 'test_generator',
            metadata: {
              testPattern: pattern.name,
              generated: true
            }
          }
        });
      }
      
      console.log(`   ✅ Created ${dates.length} release history entries`);
      
      // Create initial release schedule
      await prisma.releaseSchedule.create({
        data: {
          mangaId: pattern.mangaId,
          releaseType: pattern.releaseType,
          confidence: 0.5, // Will be updated by pattern detection
          source: 'test_generator',
          isConfirmed: false,
          metadata: {
            testPattern: pattern.name,
            sampleSize: dates.length,
            lastReleaseDate: dates[dates.length - 1]?.toISOString()
          }
        }
      });
      
      console.log(`   ✅ Created release schedule entry`);
    }
    
    console.log('\n✨ Test data generation complete!');
    console.log('\n📊 Summary:');
    console.log(`   - ${testPatterns.length} different release patterns created`);
    console.log('   - Weekly, bi-weekly, monthly, and irregular patterns');
    console.log('\n🔍 Next steps:');
    console.log('   1. Navigate to /calendar to see the generated events');
    console.log('   2. Run pattern detection on each manga');
    console.log('   3. Check the confidence scores and detected patterns');
    
  } catch (error) {
    console.error('❌ Error generating test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
generateTestData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
