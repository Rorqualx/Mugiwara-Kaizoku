/**
 * MangaUpdates Accuracy Test Corpus
 *
 * 100 diverse manga/manhwa/manhua titles for testing MU API accuracy.
 * Covers: ongoing, completed, hiatus, manhwa, manhua, classics,
 * romance, seinen, sports, light novels, one-shots, obscure titles.
 *
 * @module scripts/mangaupdates/corpus
 */

export interface CorpusEntry {
  title: string;
  anilistSearch: string;
  note: string;
  category: string;
  expectedType?: string;
}

export const MU_CORPUS: CorpusEntry[] = [
  // ============================================================================
  // Original 20 titles (from initial test run)
  // ============================================================================
  { title: 'One Piece', anilistSearch: 'One Piece', note: 'Mega-popular ongoing', category: 'ongoing' },
  { title: 'Naruto', anilistSearch: 'Naruto', note: 'Completed classic', category: 'completed' },
  { title: 'Berserk', anilistSearch: 'Berserk', note: 'Hiatus/resumed, complex status', category: 'seinen' },
  { title: 'Vinland Saga', anilistSearch: 'Vinland Saga', note: 'Completed, English publisher', category: 'completed' },
  { title: 'Solo Leveling', anilistSearch: 'Na Honjaman Level Up', note: 'Korean manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Tower of God', anilistSearch: 'Sinui Tap', note: 'Korean webtoon', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Chainsaw Man', anilistSearch: 'Chainsaw Man', note: 'Part 1+2, ongoing', category: 'ongoing' },
  { title: 'Spy x Family', anilistSearch: 'SPY x FAMILY', note: 'Ongoing, high popularity', category: 'ongoing' },
  { title: 'Vagabond', anilistSearch: 'Vagabond', note: 'Long hiatus', category: 'seinen' },
  { title: '20th Century Boys', anilistSearch: '20th Century Boys', note: 'Completed, sequel exists', category: 'completed' },
  { title: 'Goodnight Punpun', anilistSearch: 'Oyasumi Punpun', note: 'Alt title romanization', category: 'seinen' },
  { title: 'The Breaker', anilistSearch: 'The Breaker', note: 'Korean manhwa, seasons', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Pluto', anilistSearch: 'Pluto', note: 'Short completed', category: 'completed' },
  { title: 'Slam Dunk', anilistSearch: 'Slam Dunk', note: 'Classic completed', category: 'classic' },
  { title: 'Kingdom', anilistSearch: 'Kingdom', note: 'Very long ongoing', category: 'ongoing' },
  { title: 'Blue Lock', anilistSearch: 'Blue Lock', note: 'Ongoing sports', category: 'sports' },
  { title: 'Dandadan', anilistSearch: 'Dandadan', note: 'Recent ongoing', category: 'ongoing' },
  { title: 'Frieren', anilistSearch: 'Sousou no Frieren', note: 'Recent hit', category: 'ongoing' },
  { title: 'Tales of Demons and Gods', anilistSearch: 'Yaoshenji', note: 'Chinese manhua', category: 'manhua', expectedType: 'Manhua' },
  { title: 'Blame!', anilistSearch: 'Blame!', note: 'Short cyberpunk', category: 'seinen' },

  // ============================================================================
  // Manhwa / Korean (10)
  // ============================================================================
  { title: 'Noblesse', anilistSearch: 'Noblesse', note: 'Korean webtoon classic', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'The God of High School', anilistSearch: 'The God of High School', note: 'Korean action webtoon', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Sweet Home', anilistSearch: 'Sweet Home', note: 'Korean horror webtoon', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Bastard', anilistSearch: 'Bastard', note: 'Korean thriller manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Lookism', anilistSearch: 'Lookism', note: 'Korean slice-of-life webtoon', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Wind Breaker', anilistSearch: 'Wind Breaker', note: 'Korean cycling manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Weak Hero', anilistSearch: 'Weak Hero', note: 'Korean school action', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Omniscient Reader\'s Viewpoint', anilistSearch: 'Jeonjijeok Dokja Sijeom', note: 'Korean isekai manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Return of the Mount Hua Sect', anilistSearch: 'Hwasan Gwihwan', note: 'Korean martial arts manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Eleceed', anilistSearch: 'Eleceed', note: 'Korean supernatural manhwa', category: 'manhwa', expectedType: 'Manhwa' },

  // ============================================================================
  // Manhua / Chinese (8)
  // ============================================================================
  { title: 'The Beginning After the End', anilistSearch: 'The Beginning After the End', note: 'TBATE, originally English/Korean', category: 'manhua' },
  { title: 'Martial Peak', anilistSearch: 'Wushen Zhuzai', note: 'Very long Chinese cultivation', category: 'manhua', expectedType: 'Manhua' },
  { title: 'Battle Through the Heavens', anilistSearch: 'Doupo Cangqiong', note: 'Popular Chinese xianxia', category: 'manhua', expectedType: 'Manhua' },
  { title: 'Soul Land', anilistSearch: 'Douluo Dalu', note: 'Chinese cultivation classic', category: 'manhua', expectedType: 'Manhua' },
  { title: 'The King\'s Avatar', anilistSearch: 'Quan Zhi Gao Shou', note: 'Chinese esports manhua', category: 'manhua', expectedType: 'Manhua' },
  { title: 'Release That Witch', anilistSearch: 'Fang Kai Na Ge Nv Wu', note: 'Chinese isekai manhua', category: 'manhua', expectedType: 'Manhua' },
  { title: 'My Wife is a Demon Queen', anilistSearch: 'My Wife is a Demon Queen', note: 'Chinese fantasy romance', category: 'manhua', expectedType: 'Manhua' },
  { title: 'Apotheosis', anilistSearch: 'Bai Lian Cheng Shen', note: 'Chinese cultivation manhua', category: 'manhua', expectedType: 'Manhua' },

  // ============================================================================
  // Classic / Pre-2000 Manga (8)
  // ============================================================================
  { title: 'Akira', anilistSearch: 'Akira', note: 'Cyberpunk classic, completed', category: 'classic' },
  { title: 'Dragon Ball', anilistSearch: 'Dragon Ball', note: 'Shonen classic, mega franchise', category: 'classic' },
  { title: 'Sailor Moon', anilistSearch: 'Bishoujo Senshi Sailor Moon', note: 'Magical girl classic', category: 'classic' },
  { title: 'Rurouni Kenshin', anilistSearch: 'Rurouni Kenshin', note: 'Samurai classic', category: 'classic' },
  { title: 'Yu Yu Hakusho', anilistSearch: 'Yuu Yuu Hakusho', note: 'Supernatural classic', category: 'classic' },
  { title: 'Ranma 1/2', anilistSearch: 'Ranma ½', note: 'Rumiko Takahashi comedy', category: 'classic' },
  { title: 'Ghost in the Shell', anilistSearch: 'Koukaku Kidoutai: The Ghost in the Shell', note: 'Cyberpunk classic', category: 'classic' },
  { title: 'Fist of the North Star', anilistSearch: 'Hokuto no Ken', note: 'Post-apocalyptic classic', category: 'classic' },

  // ============================================================================
  // Completed Manga (8)
  // ============================================================================
  { title: 'Death Note', anilistSearch: 'Death Note', note: 'Thriller, completed', category: 'completed' },
  { title: 'Fullmetal Alchemist', anilistSearch: 'Fullmetal Alchemist', note: 'Adventure, completed', category: 'completed' },
  { title: 'Monster', anilistSearch: 'Monster', note: 'Urasawa thriller, completed', category: 'completed' },
  { title: 'Parasyte', anilistSearch: 'Kiseijuu', note: 'Sci-fi horror, completed', category: 'completed' },
  { title: 'Bakuman', anilistSearch: 'Bakuman.', note: 'Meta manga creation story', category: 'completed' },
  { title: 'Assassination Classroom', anilistSearch: 'Ansatsu Kyoushitsu', note: 'School action comedy', category: 'completed' },
  { title: 'Haikyuu!!', anilistSearch: 'Haikyuu!!', note: 'Volleyball sports, completed', category: 'sports' },
  { title: 'Toriko', anilistSearch: 'Toriko', note: 'Food adventure, completed', category: 'completed' },

  // ============================================================================
  // Ongoing Popular (8)
  // ============================================================================
  { title: 'My Hero Academia', anilistSearch: 'Boku no Hero Academia', note: 'Superhero shonen', category: 'ongoing' },
  { title: 'Jujutsu Kaisen', anilistSearch: 'Jujutsu Kaisen', note: 'Dark shonen, recently completed', category: 'ongoing' },
  { title: 'One Punch Man', anilistSearch: 'One Punch-Man', note: 'Webcomic-to-manga', category: 'ongoing' },
  { title: 'Black Clover', anilistSearch: 'Black Clover', note: 'Fantasy shonen', category: 'ongoing' },
  { title: 'Dr. Stone', anilistSearch: 'Dr. Stone', note: 'Science adventure, completed', category: 'completed' },
  { title: 'Mashle', anilistSearch: 'MASHLE', note: 'Comedy action, completed', category: 'completed' },
  { title: 'Kaiju No. 8', anilistSearch: 'Kaijuu 8-gou', note: 'Monster action, ongoing', category: 'ongoing' },
  { title: 'Sakamoto Days', anilistSearch: 'Sakamoto Days', note: 'Action comedy, ongoing', category: 'ongoing' },

  // ============================================================================
  // Romance / Shoujo / Josei (8)
  // ============================================================================
  { title: 'Fruits Basket', anilistSearch: 'Fruits Basket', note: 'Shoujo classic, completed', category: 'romance' },
  { title: 'Nana', anilistSearch: 'Nana', note: 'Josei, long hiatus', category: 'romance' },
  { title: 'Skip Beat!', anilistSearch: 'Skip Beat!', note: 'Shoujo, very long ongoing', category: 'romance' },
  { title: 'Kaguya-sama: Love is War', anilistSearch: 'Kaguya-sama wa Kokurasetai', note: 'Romcom, completed', category: 'romance' },
  { title: 'Horimiya', anilistSearch: 'Horimiya', note: 'Slice-of-life romance, completed', category: 'romance' },
  { title: 'Your Lie in April', anilistSearch: 'Shigatsu wa Kimi no Uso', note: 'Music drama, completed', category: 'romance' },
  { title: 'Lovely Complex', anilistSearch: 'Lovely★Complex', note: 'Height-gap romcom', category: 'romance' },
  { title: 'Ouran High School Host Club', anilistSearch: 'Ouran Koukou Host Club', note: 'Shoujo comedy classic', category: 'romance' },

  // ============================================================================
  // Seinen / Mature (8)
  // ============================================================================
  { title: 'Gantz', anilistSearch: 'Gantz', note: 'Sci-fi action, completed', category: 'seinen' },
  { title: 'Tokyo Ghoul', anilistSearch: 'Tokyo Ghoul', note: 'Dark fantasy, completed', category: 'seinen' },
  { title: 'Dorohedoro', anilistSearch: 'Dorohedoro', note: 'Dark fantasy comedy', category: 'seinen' },
  { title: 'Homunculus', anilistSearch: 'Homunculus', note: 'Psychological seinen', category: 'seinen' },
  { title: 'Ichi the Killer', anilistSearch: 'Ichi the Killer', note: 'Extreme violence seinen', category: 'seinen' },
  { title: 'Blade of the Immortal', anilistSearch: 'Mugen no Juunin', note: 'Samurai revenge, completed', category: 'seinen' },
  { title: 'Eden: It\'s an Endless World!', anilistSearch: 'Eden: It\'s an Endless World!', note: 'Cyberpunk sci-fi seinen', category: 'seinen' },
  { title: 'Shamo', anilistSearch: 'Shamo', note: 'Martial arts seinen', category: 'seinen' },

  // ============================================================================
  // Light Novel Adaptations (6)
  // ============================================================================
  { title: 'Overlord', anilistSearch: 'Overlord', note: 'Isekai LN manga adaptation', category: 'light-novel' },
  { title: 'Re:Zero', anilistSearch: 'Re:Zero kara Hajimeru Isekai Seikatsu', note: 'Isekai LN adaptation', category: 'light-novel' },
  { title: 'Mushoku Tensei', anilistSearch: 'Mushoku Tensei: Isekai Ittara Honki Dasu', note: 'Isekai pioneer', category: 'light-novel' },
  { title: 'That Time I Got Reincarnated as a Slime', anilistSearch: 'Tensei Shitara Slime Datta Ken', note: 'Popular isekai', category: 'light-novel' },
  { title: 'Sword Art Online', anilistSearch: 'Sword Art Online', note: 'VR isekai pioneer', category: 'light-novel' },
  { title: 'No Game No Life', anilistSearch: 'No Game No Life', note: 'Strategy isekai', category: 'light-novel' },

  // ============================================================================
  // One-Shots & Short Series (4)
  // ============================================================================
  { title: 'Uzumaki', anilistSearch: 'Uzumaki', note: 'Junji Ito horror, short', category: 'one-shot' },
  { title: 'Solanin', anilistSearch: 'Solanin', note: 'Asano Inio, 2 volumes', category: 'one-shot' },
  { title: 'All You Need Is Kill', anilistSearch: 'All You Need Is Kill', note: 'Sci-fi, 2 volumes', category: 'one-shot' },
  { title: 'Voices of a Distant Star', anilistSearch: 'Hoshi no Koe', note: 'Shinkai manga adaptation', category: 'one-shot' },

  // ============================================================================
  // Obscure / Niche (6)
  // ============================================================================
  { title: 'Real', anilistSearch: 'Real', note: 'Takehiko Inoue basketball', category: 'obscure' },
  { title: 'Kokou no Hito', anilistSearch: 'Kokou no Hito', note: 'Mountain climbing seinen', category: 'obscure' },
  { title: 'Holyland', anilistSearch: 'Holyland', note: 'Street fighting seinen', category: 'obscure' },
  { title: 'Spirit Circle', anilistSearch: 'Spirit Circle', note: 'Reincarnation drama', category: 'obscure' },
  { title: 'Sket Dance', anilistSearch: 'SKET Dance', note: 'School comedy', category: 'obscure' },
  { title: 'Helck', anilistSearch: 'Helck', note: 'Fantasy action comedy', category: 'obscure' },

  // ============================================================================
  // Sports (4)
  // ============================================================================
  { title: 'Hajime no Ippo', anilistSearch: 'Hajime no Ippo', note: 'Boxing, very long ongoing', category: 'sports' },
  { title: 'Eyeshield 21', anilistSearch: 'Eyeshield 21', note: 'American football, completed', category: 'sports' },
  { title: 'Kuroko\'s Basketball', anilistSearch: 'Kuroko no Basuke', note: 'Basketball, completed', category: 'sports' },
  { title: 'Ace of Diamond', anilistSearch: 'Diamond no Ace', note: 'Baseball, long series', category: 'sports' },

  // ============================================================================
  // Anime Adaptation Titles (for animeMapping testing) (2)
  // ============================================================================
  { title: 'Attack on Titan', anilistSearch: 'Shingeki no Kyojin', note: 'Anime adaptation, completed', category: 'completed', expectedType: 'Manga' },
  { title: 'Demon Slayer', anilistSearch: 'Kimetsu no Yaiba', note: 'Anime adaptation, completed', category: 'completed', expectedType: 'Manga' },

  // ============================================================================
  // EXPANSION: 200 more titles (101-300)
  // ============================================================================

  // ============================================================================
  // Shonen Action/Adventure (20)
  // ============================================================================
  { title: 'Hunter x Hunter', anilistSearch: 'Hunter x Hunter', note: 'Long hiatus shonen', category: 'ongoing' },
  { title: 'Bleach', anilistSearch: 'Bleach', note: 'Big three, completed', category: 'completed' },
  { title: 'Fairy Tail', anilistSearch: 'Fairy Tail', note: 'Long shonen, completed', category: 'completed' },
  { title: 'Gintama', anilistSearch: 'Gintama', note: 'Comedy action, completed', category: 'completed' },
  { title: 'D.Gray-man', anilistSearch: 'D.Gray-man', note: 'Dark shonen, hiatus-prone', category: 'ongoing' },
  { title: 'Katekyo Hitman Reborn!', anilistSearch: 'Katekyo Hitman Reborn!', note: 'Battle shonen, completed', category: 'completed' },
  { title: 'Magi', anilistSearch: 'Magi: The Labyrinth of Magic', note: 'Fantasy adventure, completed', category: 'completed' },
  { title: 'Soul Eater', anilistSearch: 'Soul Eater', note: 'Action fantasy, completed', category: 'completed' },
  { title: 'Medaka Box', anilistSearch: 'Medaka Box', note: 'Meta shonen by Nisio Isin', category: 'completed' },
  { title: 'World Trigger', anilistSearch: 'World Trigger', note: 'Sci-fi action, ongoing', category: 'ongoing' },
  { title: 'Beelzebub', anilistSearch: 'Beelzebub', note: 'Comedy action, completed', category: 'completed' },
  { title: 'Hitman', anilistSearch: 'Hitman', note: 'Manga creation comedy', category: 'completed' },
  { title: 'Undead Unluck', anilistSearch: 'Undead Unluck', note: 'Recent unique shonen', category: 'ongoing' },
  { title: 'Witch Watch', anilistSearch: 'Witch Watch', note: 'Comedy by Sket Dance author', category: 'ongoing' },
  { title: 'Mission: Yozakura Family', anilistSearch: 'Yozakura-san Chi no Daisakusen', note: 'Spy action comedy', category: 'ongoing' },
  { title: 'Ruri Dragon', anilistSearch: 'Ruri Dragon', note: 'Short hiatus-prone series', category: 'ongoing' },
  { title: 'Akane-banashi', anilistSearch: 'Akane-banashi', note: 'Rakugo story-telling manga', category: 'ongoing' },
  { title: 'Kekkaishi', anilistSearch: 'Kekkaishi', note: 'Supernatural action, completed', category: 'completed' },
  { title: 'Psyren', anilistSearch: 'Psyren', note: 'Sci-fi action, completed', category: 'completed' },
  { title: 'Flame of Recca', anilistSearch: 'Rekka no Honoo', note: 'Classic tournament battle', category: 'classic' },

  // ============================================================================
  // Seinen Drama/Thriller (20)
  // ============================================================================
  { title: 'Vagabond', anilistSearch: 'Vagabond', note: 'Duplicate check - samurai', category: 'seinen' },
  { title: 'Innocent', anilistSearch: 'Innocent', note: 'French Revolution historical', category: 'seinen' },
  { title: 'Kingdom of Gods', anilistSearch: 'Kamisama no Iutoori', note: 'Death game thriller', category: 'seinen' },
  { title: 'Liar Game', anilistSearch: 'Liar Game', note: 'Psychological game', category: 'seinen' },
  { title: 'Kaiji', anilistSearch: 'Tobaku Mokushiroku Kaiji', note: 'Gambling thriller', category: 'seinen' },
  { title: 'Btooom!', anilistSearch: 'Btooom!', note: 'Survival game', category: 'seinen' },
  { title: 'Terra Formars', anilistSearch: 'Terra Formars', note: 'Sci-fi survival', category: 'seinen' },
  { title: 'Ajin', anilistSearch: 'Ajin', note: 'Immortal thriller', category: 'seinen' },
  { title: 'Inuyashiki', anilistSearch: 'Inuyashiki', note: 'Sci-fi drama by Gantz author', category: 'seinen' },
  { title: 'I Am a Hero', anilistSearch: 'I Am a Hero', note: 'Zombie survival', category: 'seinen' },
  { title: 'Oyasumi Punpun', anilistSearch: 'Oyasumi Punpun', note: 'Psychological drama', category: 'seinen' },
  { title: 'Happiness', anilistSearch: 'Happiness', note: 'Vampire drama by Oshimi', category: 'seinen' },
  { title: 'Inside Mari', anilistSearch: 'Boku wa Mari no Naka', note: 'Psychological by Oshimi', category: 'seinen' },
  { title: 'Trail of Blood', anilistSearch: 'Chi no Wadachi', note: 'Psychological thriller', category: 'seinen' },
  { title: 'March Comes in Like a Lion', anilistSearch: '3-gatsu no Lion', note: 'Shogi drama', category: 'seinen' },
  { title: 'Land of the Lustrous', anilistSearch: 'Houseki no Kuni', note: 'Gem people sci-fi', category: 'seinen' },
  { title: 'Made in Abyss', anilistSearch: 'Made in Abyss', note: 'Dark fantasy adventure', category: 'seinen' },
  { title: 'Golden Kamuy', anilistSearch: 'Golden Kamuy', note: 'Historical adventure, completed', category: 'seinen' },
  { title: 'Dungeon Meshi', anilistSearch: 'Dungeon Meshi', note: 'Cooking fantasy, completed', category: 'seinen' },
  { title: 'Fire Punch', anilistSearch: 'Fire Punch', note: 'Dark action by Fujimoto', category: 'seinen' },

  // ============================================================================
  // Romance/Drama (20)
  // ============================================================================
  { title: 'Toradora!', anilistSearch: 'Toradora!', note: 'Romcom classic', category: 'romance' },
  { title: 'Ao Haru Ride', anilistSearch: 'Ao Haru Ride', note: 'Shoujo romance', category: 'romance' },
  { title: 'Kimi ni Todoke', anilistSearch: 'Kimi ni Todoke', note: 'Shoujo classic', category: 'romance' },
  { title: 'Nisekoi', anilistSearch: 'Nisekoi', note: 'Harem romcom, completed', category: 'romance' },
  { title: 'Quintessential Quintuplets', anilistSearch: 'Go-toubun no Hanayome', note: 'Harem romance, completed', category: 'romance' },
  { title: 'Rent-a-Girlfriend', anilistSearch: 'Kanojo, Okarishimasu', note: 'Romcom, ongoing', category: 'romance' },
  { title: 'Domestic Girlfriend', anilistSearch: 'Domestic na Kanojo', note: 'Drama romance, completed', category: 'romance' },
  { title: 'Wotakoi', anilistSearch: 'Wotaku ni Koi wa Muzukashii', note: 'Otaku romcom', category: 'romance' },
  { title: 'A Silent Voice', anilistSearch: 'Koe no Katachi', note: 'Bullying drama, completed', category: 'romance' },
  { title: 'March Story', anilistSearch: 'March Story', note: 'Gothic fantasy romance', category: 'romance' },
  { title: 'Honey and Clover', anilistSearch: 'Hachimitsu to Clover', note: 'Art school josei', category: 'romance' },
  { title: 'Paradise Kiss', anilistSearch: 'Paradise Kiss', note: 'Fashion josei drama', category: 'romance' },
  { title: 'Nodame Cantabile', anilistSearch: 'Nodame Cantabile', note: 'Music josei romcom', category: 'romance' },
  { title: 'Chihayafuru', anilistSearch: 'Chihayafuru', note: 'Karuta josei drama', category: 'romance' },
  { title: 'My Dress-Up Darling', anilistSearch: 'Sono Bisque Doll wa Koi wo Suru', note: 'Cosplay romcom', category: 'romance' },
  { title: 'Tonikaku Kawaii', anilistSearch: 'Tonikaku Kawaii', note: 'Married couple romcom', category: 'romance' },
  { title: 'Oshi no Ko', anilistSearch: 'Oshi no Ko', note: 'Entertainment industry drama', category: 'romance' },
  { title: 'Blue Box', anilistSearch: 'Ao no Hako', note: 'Sports romance, ongoing', category: 'romance' },
  { title: 'Takopi\'s Original Sin', anilistSearch: 'Takopii no Genzai', note: 'Dark short drama', category: 'romance' },
  { title: 'Insomniacs After School', anilistSearch: 'Kimi wa Houkago Insomnia', note: 'Astronomy club romance', category: 'romance' },

  // ============================================================================
  // Manhwa/Korean (20)
  // ============================================================================
  { title: 'Hardcore Leveling Warrior', anilistSearch: 'Hardcore Leveling Warrior', note: 'Gaming manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Nano Machine', anilistSearch: 'Nano Machine', note: 'Murim manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'The Boxer', anilistSearch: 'The Boxer', note: 'Boxing manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Jungle Juice', anilistSearch: 'Jungle Juice', note: 'Insect power manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Teenage Mercenary', anilistSearch: 'Mercenary Enrollment', note: 'School action manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Viral Hit', anilistSearch: 'How to Fight', note: 'Fighting manhwa by Lookism author', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Windbreaker', anilistSearch: 'Wind Breaker', note: 'Japanese Wind Breaker', category: 'ongoing', expectedType: 'Manga' },
  { title: 'Leveling with the Gods', anilistSearch: 'Singwa Hamkke Level Up', note: 'Tower climbing manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Doom Breaker', anilistSearch: 'Doom Breaker', note: 'Action manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Reformation of the Deadbeat Noble', anilistSearch: 'Reformation of the Deadbeat Noble', note: 'Swordsman manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'The S-Classes That I Raised', anilistSearch: 'Naega Kiun S-geup-deul', note: 'Hunter manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Trash of the Count\'s Family', anilistSearch: 'Baekjakgaui Mangnaniga Doeeotda', note: 'Isekai manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Superhuman Era', anilistSearch: 'Superhuman Era', note: 'Action manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Manager Kim', anilistSearch: 'Manager Kim', note: 'Action by Lookism author', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Quest Supremacy', anilistSearch: 'Quest Supremacy', note: 'System manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Study Group', anilistSearch: 'Study Group', note: 'School action manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Reaper of the Drifting Moon', anilistSearch: 'Reaper of the Drifting Moon', note: 'Murim assassin manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'The Horizon', anilistSearch: 'The Horizon', note: 'Short post-apocalyptic manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Cheese in the Trap', anilistSearch: 'Cheese in the Trap', note: 'Psychological romance manhwa', category: 'manhwa', expectedType: 'Manhwa' },
  { title: 'Itaewon Class', anilistSearch: 'Itaewon Class', note: 'Business revenge manhwa', category: 'manhwa', expectedType: 'Manhwa' },

  // ============================================================================
  // Manhua/Chinese (15)
  // ============================================================================
  { title: 'Feng Shen Ji', anilistSearch: 'Feng Shen Ji', note: 'Epic Chinese mythology', category: 'manhua', expectedType: 'Manhua' },
  { title: 'The Last Human', anilistSearch: 'The Last Human', note: 'Zombie survival manhua', category: 'manhua', expectedType: 'Manhua' },
  { title: 'Song of the Long March', anilistSearch: 'Chang Ge Xing', note: 'Historical manhua', category: 'manhua', expectedType: 'Manhua' },
  { title: 'Tamen De Gushi', anilistSearch: 'Tamen De Gushi', note: 'Yuri manhua', category: 'manhua', expectedType: 'Manhua' },
  { title: 'Versatile Mage', anilistSearch: 'Quanzhifashi', note: 'Magic school manhua', category: 'manhua', expectedType: 'Manhua' },
  { title: 'Doupo Cangqiong', anilistSearch: 'Doupo Cangqiong', note: 'Xianxia cultivation', category: 'manhua', expectedType: 'Manhua' },
  { title: 'Spirit Blade Mountain', anilistSearch: 'Cong Qian You Zuo Ling Jian Shan', note: 'Cultivation comedy', category: 'manhua', expectedType: 'Manhua' },
  { title: 'Wan Gu Shen Wang', anilistSearch: 'Wan Gu Shen Wang', note: 'God King cultivation', category: 'manhua', expectedType: 'Manhua' },
  { title: 'Yuan Zun', anilistSearch: 'Yuan Zun', note: 'Dragon Prince cultivation', category: 'manhua', expectedType: 'Manhua' },
  { title: 'Spare Me Great Lord', anilistSearch: 'Da Wang Rao Ming', note: 'Comedy cultivation', category: 'manhua', expectedType: 'Manhua' },
  { title: 'Cultivation Chat Group', anilistSearch: 'Cultivation Chat Group', note: 'Modern cultivation comedy', category: 'manhua', expectedType: 'Manhua' },
  { title: 'My Amazing Wechat', anilistSearch: 'My Amazing Wechat', note: 'System manhua', category: 'manhua', expectedType: 'Manhua' },
  { title: 'Panlong', anilistSearch: 'Panlong', note: 'IET novel adaptation', category: 'manhua', expectedType: 'Manhua' },
  { title: 'Iron Ladies', anilistSearch: 'Iron Ladies', note: 'Mech action manhua', category: 'manhua', expectedType: 'Manhua' },
  { title: 'Douluo Dalu II', anilistSearch: 'Douluo Dalu II: Jueshi Tangmen', note: 'Soul Land sequel', category: 'manhua', expectedType: 'Manhua' },

  // ============================================================================
  // Horror/Psychological (15)
  // ============================================================================
  { title: 'Tomie', anilistSearch: 'Tomie', note: 'Junji Ito horror classic', category: 'horror' },
  { title: 'Gyo', anilistSearch: 'Gyo', note: 'Junji Ito body horror', category: 'horror' },
  { title: 'The Drifting Classroom', anilistSearch: 'Hyouryuu Kyoushitsu', note: 'Classic horror manga', category: 'horror' },
  { title: 'Mpd Psycho', anilistSearch: 'Tajuu Jinkaku Tantei Psycho', note: 'Psychological horror', category: 'horror' },
  { title: 'Hideout', anilistSearch: 'Hideout', note: 'Cave horror one-shot', category: 'horror' },
  { title: 'Dragon Head', anilistSearch: 'Dragon Head', note: 'Post-apocalyptic horror', category: 'horror' },
  { title: 'Franken Fran', anilistSearch: 'Franken Fran', note: 'Horror comedy', category: 'horror' },
  { title: 'Emerging', anilistSearch: 'Emerging', note: 'Pandemic horror', category: 'horror' },
  { title: 'Manhole', anilistSearch: 'Manhole', note: 'Bio-horror thriller', category: 'horror' },
  { title: 'Another', anilistSearch: 'Another', note: 'Curse horror mystery', category: 'horror' },
  { title: 'Ibitsu', anilistSearch: 'Ibitsu', note: 'Lolita horror', category: 'horror' },
  { title: 'Lesson of the Evil', anilistSearch: 'Aku no Kyouten', note: 'Teacher thriller', category: 'horror' },
  { title: 'Pumpkin Night', anilistSearch: 'Pumpkin Night', note: 'Slasher horror', category: 'horror' },
  { title: 'Jigokuraku', anilistSearch: 'Jigokuraku', note: 'Hell paradise action', category: 'horror' },
  { title: 'Dandadan', anilistSearch: 'Dandadan', note: 'Supernatural action comedy', category: 'ongoing' },

  // ============================================================================
  // Isekai/Fantasy (20)
  // ============================================================================
  { title: 'Konosuba', anilistSearch: 'Kono Subarashii Sekai ni Shukufuku wo!', note: 'Comedy isekai', category: 'light-novel' },
  { title: 'The Rising of the Shield Hero', anilistSearch: 'Tate no Yuusha no Nariagari', note: 'Dark isekai', category: 'light-novel' },
  { title: 'So I\'m a Spider, So What?', anilistSearch: 'Kumo Desu ga, Nani ka?', note: 'Monster reincarnation', category: 'light-novel' },
  { title: 'The Saga of Tanya the Evil', anilistSearch: 'Youjo Senki', note: 'Military isekai', category: 'light-novel' },
  { title: 'Arifureta', anilistSearch: 'Arifureta Shokugyou de Sekai Saikyou', note: 'Dark isekai, OP protag', category: 'light-novel' },
  { title: 'Log Horizon', anilistSearch: 'Log Horizon', note: 'MMO strategy isekai', category: 'light-novel' },
  { title: 'Goblin Slayer', anilistSearch: 'Goblin Slayer', note: 'Dark fantasy', category: 'light-novel' },
  { title: 'Bofuri', anilistSearch: 'Itai no wa Iya nano de Bougyoryoku ni Kyokufuri Shitai to Omoimasu.', note: 'VRMMO comedy', category: 'light-novel' },
  { title: 'Tsukimichi', anilistSearch: 'Tsuki ga Michibiku Isekai Douchuu', note: 'Isekai fantasy', category: 'light-novel' },
  { title: 'Grimgar', anilistSearch: 'Hai to Gensou no Grimgar', note: 'Realistic isekai', category: 'light-novel' },
  { title: 'Faraway Paladin', anilistSearch: 'Saihate no Paladin', note: 'Undead-raised paladin', category: 'light-novel' },
  { title: 'Frieren', anilistSearch: 'Sousou no Frieren', note: 'Post-quest elf fantasy', category: 'ongoing' },
  { title: 'The Ancient Magus\' Bride', anilistSearch: 'Mahoutsukai no Yome', note: 'Gothic fantasy romance', category: 'ongoing' },
  { title: 'Claymore', anilistSearch: 'Claymore', note: 'Dark fantasy action', category: 'completed' },
  { title: 'Berserk of Gluttony', anilistSearch: 'Boushoku no Berserk', note: 'Skill-based fantasy', category: 'ongoing' },
  { title: 'Tsugumomo', anilistSearch: 'Tsugumomo', note: 'Action ecchi fantasy', category: 'ongoing' },
  { title: 'Black Butler', anilistSearch: 'Kuroshitsuji', note: 'Victorian dark fantasy', category: 'ongoing' },
  { title: 'Maoujou de Oyasumi', anilistSearch: 'Maoujou de Oyasumi', note: 'Princess comedy fantasy', category: 'completed' },
  { title: 'Mairimashita! Iruma-kun', anilistSearch: 'Mairimashita! Iruma-kun', note: 'Demon school comedy', category: 'ongoing' },
  { title: 'Radiant', anilistSearch: 'Radiant', note: 'French-origin manga', category: 'ongoing' },

  // ============================================================================
  // Sports/Competition (15)
  // ============================================================================
  { title: 'Haikyu!! (duplicate check)', anilistSearch: 'Haikyuu!!', note: 'Volleyball sports', category: 'sports' },
  { title: 'Captain Tsubasa', anilistSearch: 'Captain Tsubasa', note: 'Classic soccer manga', category: 'classic' },
  { title: 'Yowamushi Pedal', anilistSearch: 'Yowamushi Pedal', note: 'Cycling sports', category: 'sports' },
  { title: 'Baby Steps', anilistSearch: 'Baby Steps', note: 'Tennis, completed', category: 'sports' },
  { title: 'Chihayafuru', anilistSearch: 'Chihayafuru', note: 'Competitive karuta', category: 'sports' },
  { title: 'Run with the Wind', anilistSearch: 'Kaze ga Tsuyoku Fuiteiru', note: 'Running novel adaptation', category: 'sports' },
  { title: 'All Rounder Meguru', anilistSearch: 'All Rounder Meguru', note: 'MMA sports seinen', category: 'sports' },
  { title: 'Ashita no Joe', anilistSearch: 'Ashita no Joe', note: 'Classic boxing manga', category: 'classic' },
  { title: 'Ping Pong', anilistSearch: 'Ping Pong', note: 'Table tennis by Matsumoto', category: 'sports' },
  { title: 'Over Drive', anilistSearch: 'Over Drive', note: 'Cycling manga', category: 'sports' },
  { title: 'Giant Killing', anilistSearch: 'Giant Killing', note: 'Soccer management', category: 'sports' },
  { title: 'Ao Ashi', anilistSearch: 'Ao Ashi', note: 'Soccer youth manga', category: 'sports' },
  { title: 'Slam Dunk (duplicate)', anilistSearch: 'Slam Dunk', note: 'Basketball classic', category: 'classic' },
  { title: 'Hinomaru Sumo', anilistSearch: 'Hinomaruzumou', note: 'Sumo wrestling', category: 'sports' },
  { title: 'Kengan Ashura', anilistSearch: 'Kengan Ashura', note: 'Underground fighting', category: 'sports' },

  // ============================================================================
  // Slice of Life / Comedy (15)
  // ============================================================================
  { title: 'Yotsuba&!', anilistSearch: 'Yotsubato!', note: 'Wholesome comedy, ongoing', category: 'slice-of-life' },
  { title: 'Nichijou', anilistSearch: 'Nichijou', note: 'Absurdist comedy', category: 'slice-of-life' },
  { title: 'Azumanga Daioh', anilistSearch: 'Azumanga Daioh', note: '4-koma classic comedy', category: 'slice-of-life' },
  { title: 'Barakamon', anilistSearch: 'Barakamon', note: 'Calligraphy rural comedy', category: 'slice-of-life' },
  { title: 'Silver Spoon', anilistSearch: 'Gin no Saji', note: 'Farm life by FMA author', category: 'slice-of-life' },
  { title: 'Grand Blue', anilistSearch: 'Grand Blue', note: 'College diving comedy', category: 'slice-of-life' },
  { title: 'Daily Lives of High School Boys', anilistSearch: 'Danshi Koukousei no Nichijou', note: 'Skit comedy', category: 'slice-of-life' },
  { title: 'Way of the Househusband', anilistSearch: 'Gokushufudou', note: 'Yakuza househusband comedy', category: 'slice-of-life' },
  { title: 'Spy x Family (duplicate)', anilistSearch: 'SPY x FAMILY', note: 'Family comedy action', category: 'ongoing' },
  { title: 'Yuru Camp', anilistSearch: 'Yuru Camp△', note: 'Camping slice of life', category: 'slice-of-life' },
  { title: 'K-On!', anilistSearch: 'K-On!', note: 'Music slice of life', category: 'slice-of-life' },
  { title: 'Non Non Biyori', anilistSearch: 'Non Non Biyori', note: 'Rural life comedy', category: 'slice-of-life' },
  { title: 'Mob Psycho 100', anilistSearch: 'Mob Psycho 100', note: 'Psychic comedy by ONE', category: 'completed' },
  { title: 'Saiki Kusuo no Psi-nan', anilistSearch: 'Saiki Kusuo no Ψ-nan', note: 'Psychic comedy', category: 'completed' },
  { title: 'Hinamatsuri', anilistSearch: 'Hinamatsuri', note: 'Esper yakuza comedy', category: 'completed' },

  // ============================================================================
  // Sci-Fi (15)
  // ============================================================================
  { title: 'Planetes', anilistSearch: 'Planetes', note: 'Hard sci-fi space debris', category: 'seinen' },
  { title: '20th Century Boys (duplicate)', anilistSearch: '20th Century Boys', note: 'Conspiracy sci-fi', category: 'completed' },
  { title: 'Biomega', anilistSearch: 'Biomega', note: 'Nihei sci-fi action', category: 'seinen' },
  { title: 'Knights of Sidonia', anilistSearch: 'Sidonia no Kishi', note: 'Mecha sci-fi by Nihei', category: 'seinen' },
  { title: 'Gantz (duplicate)', anilistSearch: 'Gantz', note: 'Death game sci-fi', category: 'seinen' },
  { title: 'Battle Angel Alita', anilistSearch: 'Gunnm', note: 'Cyberpunk classic', category: 'classic' },
  { title: 'Trigun', anilistSearch: 'Trigun', note: 'Sci-fi western', category: 'classic' },
  { title: 'Nausicaa', anilistSearch: 'Kaze no Tani no Nausicaa', note: 'Miyazaki eco sci-fi', category: 'classic' },
  { title: 'Legend of the Galactic Heroes', anilistSearch: 'Ginga Eiyuu Densetsu', note: 'Space opera classic', category: 'classic' },
  { title: 'Astra Lost in Space', anilistSearch: 'Kanata no Astra', note: 'Space survival mystery', category: 'completed' },
  { title: 'Dr. Stone (duplicate)', anilistSearch: 'Dr. Stone', note: 'Science rebuild', category: 'completed' },
  { title: 'World\'s End Harem', anilistSearch: 'Shuumatsu no Harem', note: 'Ecchi sci-fi', category: 'seinen' },
  { title: 'Promised Neverland', anilistSearch: 'Yakusoku no Neverland', note: 'Escape thriller', category: 'completed' },
  { title: 'Assassination Classroom (duplicate)', anilistSearch: 'Ansatsu Kyoushitsu', note: 'School sci-fi comedy', category: 'completed' },
  { title: 'Space Brothers', anilistSearch: 'Uchuu Kyoudai', note: 'NASA astronaut drama', category: 'seinen' },

  // ============================================================================
  // Classic/Retro (15)
  // ============================================================================
  { title: 'Astro Boy', anilistSearch: 'Tetsuwan Atom', note: 'Tezuka pioneering manga', category: 'classic' },
  { title: 'Phoenix', anilistSearch: 'Hi no Tori', note: 'Tezuka magnum opus', category: 'classic' },
  { title: 'Devilman', anilistSearch: 'Devilman', note: 'Go Nagai classic', category: 'classic' },
  { title: 'Mazinger Z', anilistSearch: 'Mazinger Z', note: 'Mecha pioneer', category: 'classic' },
  { title: 'Lone Wolf and Cub', anilistSearch: 'Kozure Ookami', note: 'Samurai classic', category: 'classic' },
  { title: 'Cyborg 009', anilistSearch: 'Cyborg 009', note: 'Classic superhero', category: 'classic' },
  { title: 'Lupin III', anilistSearch: 'Lupin Sansei', note: 'Gentleman thief', category: 'classic' },
  { title: 'Doraemon', anilistSearch: 'Doraemon', note: 'Iconic children manga', category: 'classic' },
  { title: 'Captain Harlock', anilistSearch: 'Uchuu Kaizoku Captain Herlock', note: 'Space pirate classic', category: 'classic' },
  { title: 'City Hunter', anilistSearch: 'City Hunter', note: 'Action comedy classic', category: 'classic' },
  { title: 'JoJo\'s Bizarre Adventure', anilistSearch: 'JoJo no Kimyou na Bouken Part 1: Phantom Blood', note: 'Multi-part saga', category: 'classic' },
  { title: 'Kinnikuman', anilistSearch: 'Kinnikuman', note: 'Wrestling comedy classic', category: 'classic' },
  { title: 'Touch', anilistSearch: 'Touch', note: 'Adachi baseball classic', category: 'classic' },
  { title: 'Glass Mask', anilistSearch: 'Glass no Kamen', note: 'Acting drama classic', category: 'classic' },
  { title: 'Rose of Versailles', anilistSearch: 'Versailles no Bara', note: 'Historical shoujo classic', category: 'classic' },

  // ============================================================================
  // Misc/Niche (15)
  // ============================================================================
  { title: 'Vagabond (duplicate)', anilistSearch: 'Vagabond', note: 'Samurai by Inoue', category: 'seinen' },
  { title: 'Yokohama Kaidashi Kikou', anilistSearch: 'Yokohama Kaidashi Kikou', note: 'Iyashikei sci-fi', category: 'obscure' },
  { title: 'Aria', anilistSearch: 'Aria', note: 'Neo-Venetia iyashikei', category: 'obscure' },
  { title: 'Mushishi', anilistSearch: 'Mushishi', note: 'Supernatural episodic', category: 'obscure' },
  { title: 'Natsume Yuujinchou', anilistSearch: 'Natsume Yuujinchou', note: 'Yokai slice of life', category: 'obscure' },
  { title: 'Yona of the Dawn', anilistSearch: 'Akatsuki no Yona', note: 'Historical fantasy shoujo', category: 'romance' },
  { title: 'Snow White with the Red Hair', anilistSearch: 'Akagami no Shirayuki-hime', note: 'Fantasy shoujo', category: 'romance' },
  { title: 'Magi: Sinbad no Bouken', anilistSearch: 'Magi: Sinbad no Bouken', note: 'Prequel spinoff', category: 'completed' },
  { title: 'The Apothecary Diaries', anilistSearch: 'Kusuriya no Hitorigoto', note: 'Historical mystery, popular', category: 'ongoing' },
  { title: 'Spy x Family (duplicate 2)', anilistSearch: 'SPY x FAMILY', note: 'Consistency check', category: 'ongoing' },
  { title: 'Blue Period', anilistSearch: 'Blue Period', note: 'Art university drama', category: 'seinen' },
  { title: 'Chainsaw Man (duplicate)', anilistSearch: 'Chainsaw Man', note: 'Consistency check', category: 'ongoing' },
  { title: 'Vagabond (duplicate 2)', anilistSearch: 'Vagabond', note: 'Consistency check', category: 'seinen' },
  { title: 'Act-Age', anilistSearch: 'Act-Age', note: 'Acting manga, cancelled', category: 'completed' },
  { title: 'Dandadan (duplicate)', anilistSearch: 'Dandadan', note: 'Consistency check', category: 'ongoing' },

  // ============================================================================
  // BL/GL/Josei (10)
  // ============================================================================
  { title: 'Given', anilistSearch: 'Given', note: 'BL music drama', category: 'romance' },
  { title: 'Banana Fish', anilistSearch: 'Banana Fish', note: 'Crime drama, classic', category: 'seinen' },
  { title: 'Bloom Into You', anilistSearch: 'Yagate Kimi ni Naru', note: 'Yuri romance', category: 'romance' },
  { title: 'Citrus', anilistSearch: 'Citrus', note: 'Yuri drama', category: 'romance' },
  { title: 'Doukyuusei', anilistSearch: 'Doukyuusei', note: 'BL school romance', category: 'romance' },
  { title: 'My Brother\'s Husband', anilistSearch: 'Otouto no Otto', note: 'Slice of life drama', category: 'seinen' },
  { title: 'Wandering Son', anilistSearch: 'Hourou Musuko', note: 'Gender identity drama', category: 'seinen' },
  { title: 'What Did You Eat Yesterday?', anilistSearch: 'Kinou Nani Tabeta?', note: 'Cooking BL slice-of-life', category: 'seinen' },
  { title: 'Blue Flag', anilistSearch: 'Blue Flag', note: 'LGBT romance drama', category: 'romance' },
  { title: 'Sasaki to Miyano', anilistSearch: 'Sasaki to Miyano', note: 'BL school romance', category: 'romance' },
];
