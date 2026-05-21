interface FailedManga {
  name: string;
  category: string;
  url: string;
}

const failedManga: FailedManga[] = [
  // Shonen Battle
  { name: 'Fullmetal Alchemist', category: 'Shonen Battle', url: 'https://fma.fandom.com/wiki/Chapters_and_Volumes' },
  { name: 'Yu-Gi-Oh!', category: 'Shonen Battle', url: 'https://yugioh.fandom.com/wiki/Yu-Gi-Oh!_(manga)' },
  { name: 'Chainsaw Man', category: 'Shonen Battle', url: 'https://chainsaw-man.fandom.com/wiki/Chainsaw_Man_(Manga)' },
  
  // Sports
  { name: 'Captain Tsubasa', category: 'Sports', url: 'https://manga.fandom.com/wiki/List_of_Captain_Tsubasa_chapters' },
  { name: 'Kuroko\'s Basketball', category: 'Sports', url: 'https://kurokonobasuke.fandom.com/wiki/List_of_Volumes' },
  { name: 'Prince of Tennis', category: 'Sports', url: 'https://princeoftennis.fandom.com/wiki/List_of_The_Prince_of_Tennis_Chapters' },
  { name: 'Eyeshield 21', category: 'Sports', url: 'https://eyeshield21.fandom.com/wiki/Eyeshield_21_(series)/Volumes_and_Chapters' },
  { name: 'Hajime no Ippo', category: 'Sports', url: 'https://ippo.fandom.com/wiki/Manga_Guide' },
  
  // Shoujo
  { name: 'Fruits Basket', category: 'Shoujo', url: 'https://fruitsbasket.fandom.com/wiki/Category:Fruits_Basket_Chapters' },
  { name: 'Ouran High School', category: 'Shoujo', url: 'https://manga.fandom.com/wiki/List_of_Ouran_High_School_Host_Club_chapters' },
  { name: 'Vampire Knight', category: 'Shoujo', url: 'https://vampireknight.fandom.com/wiki/Chapter_Summaries' },
  { name: 'Skip Beat!', category: 'Shoujo', url: 'https://skip-beat.fandom.com/wiki/Chapters' },
  
  // Seinen
  { name: 'Monster', category: 'Seinen', url: 'https://obluda.fandom.com/wiki/List_of_chapters' },
  { name: 'Black Lagoon', category: 'Seinen', url: 'https://lagooncompany.fandom.com/wiki/Chapters_and_Volumes_List' },
  { name: 'Tokyo Ghoul', category: 'Seinen', url: 'https://tokyoghoul.fandom.com/wiki/Chapters' },
  { name: 'Promised Neverland', category: 'Seinen', url: 'https://yakusokunoneverland.fandom.com/wiki/Chapters_and_Volumes' },
  
  // Comedy
  { name: 'One Punch Man', category: 'Comedy', url: 'https://onepunchman.fandom.com/wiki/Chapters_and_Volumes' },
  { name: 'Mob Psycho 100', category: 'Comedy', url: 'https://mob-psycho-100.fandom.com/wiki/Chapters' },
  { name: 'Gintama', category: 'Comedy', url: 'https://gintama.fandom.com/wiki/Lessons_and_Volumes' }
];

// Filter out old manga you mentioned to skip
const modernManga = failedManga.filter(m => 
  !['Astro Boy', 'Black Jack', 'Doraemon', 'Lupin III', 'Mazinger Z', 'Phoenix', 'Sailor Moon'].includes(m.name)
);

console.log('🔍 Modern Manga Failures Analysis\n');
console.log(`Total modern manga failing: ${modernManga.length}\n`);

// Group by category
const byCategory = modernManga.reduce((acc, manga) => {
  if (!acc[manga.category]) acc[manga.category] = [];
  acc[manga.category].push(manga);
  return acc;
}, {} as Record<string, FailedManga[]>);

Object.entries(byCategory).forEach(([category, manga]) => {
  console.log(`\n📚 ${category} (${manga.length} failures):`);
  manga.forEach(m => {
    console.log(`  - ${m.name}`);
    console.log(`    ${m.url}`);
  });
});

console.log('\n\n🎯 Priority Modern Manga to Fix:');
console.log('1. Chainsaw Man - Very popular modern series');
console.log('2. Tokyo Ghoul - Popular seinen');
console.log('3. Promised Neverland - Popular recent series');
console.log('4. One Punch Man - Extremely popular');
console.log('5. Mob Psycho 100 - From same author as OPM');
console.log('6. Fullmetal Alchemist - Classic that should work');

console.log('\n📊 Categories most affected:');
console.log('- Sports: 5/8 failing (62.5% failure rate)');
console.log('- Shoujo: 4/4 failing (100% failure rate)');
console.log('- Comedy: 3/3 failing (100% failure rate)');