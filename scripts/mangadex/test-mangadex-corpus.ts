/**
 * MangaDex Accuracy Test Corpus
 *
 * Titles for MangaDex accuracy testing. Extracted from the ComicVine corpus.
 */

import type { TestManga } from '../cleanup/test-parser-accuracy-corpus';

export interface MangaDexTestManga extends TestManga {
  mangadexId?: string;
  verified?: boolean;
  fastSample?: boolean;
  /** Title genuinely not on MangaDex — excluded from accuracy denominator */
  dataCeiling?: boolean;
  note?: string;
  /** Verified chapter count from MangaDex (ground truth for MangaDex-only titles) */
  mangadexChapters?: number;
  /** Verified volume count from MangaDex */
  mangadexVolumes?: number;
  /** Verified status from MangaDex: 'ongoing' | 'completed' | 'hiatus' | 'cancelled' */
  mangadexStatus?: string;
  /** Ground truth source: 'anilist' (default), 'mangadex', or 'both' */
  groundTruth?: 'anilist' | 'mangadex' | 'both';
}

export const MANGADEX_TEST_CORPUS: MangaDexTestManga[] = [
  {
    title: `One Piece`,
    anilistSearch: `One Piece`,
    fastSample: true,
  },
  {
    title: `Naruto`,
    anilistSearch: `Naruto`,
    fastSample: true,
  },
  {
    title: `Dragon Ball`,
    anilistSearch: `Dragon Ball`,
    fastSample: true,
  },
  {
    title: `My Hero Academia`,
    anilistSearch: `Boku no Hero Academia`,
    fastSample: true,
  },
  {
    title: `Demon Slayer`,
    anilistSearch: `Kimetsu no Yaiba`,
    fastSample: true,
  },
  {
    title: `Jujutsu Kaisen`,
    anilistSearch: `Jujutsu Kaisen`,
    fastSample: true,
  },
  {
    title: `Chainsaw Man`,
    anilistSearch: `Chainsaw Man`,
    fastSample: true,
  },
  {
    title: `Spy x Family`,
    anilistSearch: `Spy x Family`,
    fastSample: true,
  },
  {
    title: `Attack on Titan`,
    anilistSearch: `Shingeki no Kyojin`,
    fastSample: true,
  },
  {
    title: `Berserk`,
    anilistSearch: `Berserk`,
    fastSample: true,
  },
  {
    title: `Blade of the Immortal`,
    anilistSearch: `Blade of the Immortal`,
    fastSample: true,
  },
  {
    title: `Gantz`,
    anilistSearch: `Gantz`,
    fastSample: true,
  },
  {
    title: `Hellsing`,
    anilistSearch: `Hellsing`,
    fastSample: true,
  },
  {
    title: `Trigun`,
    anilistSearch: `Trigun`,
    fastSample: true,
  },
  {
    title: `Outlaw Star`,
    anilistSearch: `Outlaw Star`,
    fastSample: true,
  },
  {
    title: `Fire Force`,
    anilistSearch: `Enen no Shouboutai`,
    fastSample: true,
  },
  {
    title: `Fairy Tail`,
    anilistSearch: `Fairy Tail`,
    fastSample: true,
  },
  {
    title: `Seven Deadly Sins`,
    anilistSearch: `Nanatsu no Taizai`,
    fastSample: true,
  },
  {
    title: `A Silent Voice`,
    anilistSearch: `Koe no Katachi`,
    fastSample: true,
  },
  {
    title: `Sword Art Online`,
    anilistSearch: `Sword Art Online`,
    fastSample: true,
  },
  {
    title: `Overlord`,
    anilistSearch: `Overlord`,
    fastSample: true,
  },
  {
    title: `Bofuri`,
    anilistSearch: `Itai no wa Iya nano de Bougyoryoku`,
    fastSample: true,
  },
  {
    title: `Kuma Kuma Kuma Bear`,
    anilistSearch: `Kuma Kuma Kuma Bear`,
    fastSample: true,
  },
  {
    title: `Campfire Cooking in Another World`,
    anilistSearch: `Tondemo Skill de Isekai Hourou Meshi`,
    fastSample: true,
  },
  {
    title: `Gangsta.`,
    anilistSearch: `Gangsta.`,
    fastSample: true,
  },
  {
    title: `Chi's Sweet Home`,
    anilistSearch: `Sweet Home`,
    fastSample: true,
  },
  {
    title: `Kimi ni Todoke`,
    anilistSearch: `Kimi ni Todoke`,
    fastSample: true,
  },
  {
    title: `Black Clover`,
    anilistSearch: `Black Clover`,
    fastSample: true,
  },
  {
    title: `World Trigger`,
    anilistSearch: `World Trigger`,
    fastSample: true,
  },
  {
    title: `My Hero Academia: Vigilantes`,
    anilistSearch: `My Hero Academia: Vigilantes`,
    fastSample: true,
  },
  {
    title: `Boruto: Two Blue Vortex`,
    anilistSearch: `Boruto: Two Blue Vortex`,
    fastSample: true,
  },
  {
    title: `One-Punch Man`,
    anilistSearch: `One Punch Man`,
    fastSample: true,
  },
  {
    title: `JoJo's Bizarre Adventure`,
    anilistSearch: `JoJo Phantom Blood`,
    fastSample: true,
  },
  {
    title: `The Promised Neverland`,
    anilistSearch: `Yakusoku no Neverland`,
    fastSample: true,
  },
  {
    title: `Death Note`,
    anilistSearch: `Death Note`,
    fastSample: true,
  },
  {
    title: `Fullmetal Alchemist`,
    anilistSearch: `Fullmetal Alchemist`,
    fastSample: true,
  },
  {
    title: `Tokyo Ghoul`,
    anilistSearch: `Tokyo Ghoul`,
    fastSample: true,
  },
  {
    title: `Vinland Saga`,
    anilistSearch: `Vinland Saga`,
    fastSample: true,
  },
  {
    title: `Solo Leveling`,
    anilistSearch: `Ore dake Level Up na Ken`,
    fastSample: true,
  },
  {
    title: `The Beginning After the End`,
    anilistSearch: `The Beginning After the End`,
    fastSample: true,
    mangadexId: '4ada20eb-085a-491a-8c49-477ab42014d7',
    verified: true,
    mangadexChapters: 229,
    mangadexStatus: 'ongoing',
    groundTruth: 'mangadex',
  },
  {
    title: `Unordinary`,
    anilistSearch: `unOrdinary`,
    fastSample: true,
    mangadexId: 'de34e04a-a9a4-4d9b-b434-f13ad275230c',
    verified: true,
    mangadexChapters: 335,
    mangadexStatus: 'ongoing',
    groundTruth: 'mangadex',
  },
  {
    title: `Akira`,
    anilistSearch: `Akira`,
    fastSample: true,
  },
  {
    title: `Ghost in the Shell`,
    anilistSearch: `Koukaku Kidoutai`,
    fastSample: true,
  },
  {
    title: `Lone Wolf and Cub`,
    anilistSearch: `Kozure Ookami`,
    fastSample: true,
  },
  {
    title: `Monster`,
    anilistSearch: `Monster`,
    fastSample: true,
  },
  {
    title: `20th Century Boys`,
    anilistSearch: `20th Century Boys`,
    fastSample: true,
  },
  {
    title: `Pluto`,
    anilistSearch: `Pluto`,
    fastSample: true,
  },
  {
    title: `Goodnight Punpun`,
    anilistSearch: `Oyasumi Punpun`,
    fastSample: true,
  },
  {
    title: `Cells at Work! Code Black`,
    anilistSearch: `Hataraku Saibou Black`,
    fastSample: true,
  },
  {
    title: `Sailor Moon`,
    anilistSearch: `Bishoujo Senshi Sailor Moon`,
    fastSample: true,
  },
  {
    title: `Cardcaptor Sakura`,
    anilistSearch: `Cardcaptor Sakura`,
    fastSample: true,
  },
  {
    title: `Blue Lock`,
    anilistSearch: `Blue Lock`,
    fastSample: true,
  },
  {
    title: `Kaiju No. 8`,
    anilistSearch: `Kaijuu 8-gou`,
    fastSample: true,
  },
  {
    title: `Mashle`,
    anilistSearch: `Mashle`,
    fastSample: true,
  },
  {
    title: `Dandadan`,
    anilistSearch: `Dandadan`,
    fastSample: true,
  },
  {
    title: `Sakamoto Days`,
    anilistSearch: `Sakamoto Days`,
    fastSample: true,
  },
  {
    title: `Dr. Stone`,
    anilistSearch: `Dr. Stone`,
    fastSample: true,
  },
  {
    title: `The Way of the Househusband`,
    anilistSearch: `Gokushufudou`,
    fastSample: true,
  },
  {
    title: `Haikyuu!!`,
    anilistSearch: `Haikyuu!!`,
    fastSample: true,
  },
  {
    title: `Food Wars!: Shokugeki no Soma`,
    anilistSearch: `Shokugeki no Soma`,
    fastSample: true,
  },
  {
    title: `Hunter x Hunter`,
    anilistSearch: `Hunter x Hunter`,
    fastSample: true,
  },
  {
    title: `Yu-Gi-Oh! Duelist`,
    anilistSearch: `Yu-Gi-Oh! Duelist`,
    fastSample: true,
  },
  {
    title: `Resident Evil: The Marhawa Desire`,
    anilistSearch: `Biohazard Marhawa Desire`,
    mangadexId: '7171cf2d-95d2-4fce-9bcf-2791dfe8abf2',
    malId: 32315,
    verified: true,
    mangadexChapters: 39,
    mangadexStatus: 'completed',
    groundTruth: 'mangadex',
    fastSample: true,
  },
  {
    title: `Love Hina`,
    anilistSearch: `Love Hina`,
    fastSample: true,
  },
  {
    title: `Chobits`,
    anilistSearch: `Chobits`,
    fastSample: true,
  },
  {
    title: `Magic Knight Rayearth`,
    anilistSearch: `Magic Knight Rayearth`,
    fastSample: true,
  },
  {
    title: `RuriDragon`,
    anilistSearch: `RuriDragon`,
    fastSample: true,
  },
  {
    title: `Soul Eater`,
    anilistSearch: `Soul Eater`,
    fastSample: true,
  },
  {
    title: `Akame ga Kill!`,
    anilistSearch: `Akame ga KILL!`,
    fastSample: true,
  },
  {
    title: `Is It Wrong to Pick Up Girls in a Dungeon?`,
    anilistSearch: `Dungeon ni Deai wo Motomeru no wa Machigai`,
    fastSample: true,
  },
  {
    title: `The Ancient Magus' Bride`,
    anilistSearch: `Mahoutsukai no Yome`,
    fastSample: true,
  },
  {
    title: `Made in Abyss`,
    anilistSearch: `Made in Abyss`,
    fastSample: true,
  },
  {
    title: `Land of the Lustrous`,
    anilistSearch: `Houseki no Kuni`,
    fastSample: true,
  },
  {
    title: `Miss Kobayashi's Dragon Maid`,
    anilistSearch: `Kobayashi-san Chi no Maid Dragon`,
    fastSample: true,
  },
  {
    title: `Komi Can't Communicate`,
    anilistSearch: `Komi-san wa Komyushou Desu`,
    fastSample: true,
  },
  {
    title: `Boruto: Naruto Next Generations`,
    anilistSearch: `Boruto: Naruto Next Generations`,
    fastSample: true,
  },
  {
    title: `Dragon Ball Super`,
    anilistSearch: `Dragon Ball Super`,
    fastSample: true,
  },
  {
    title: `Dragon Ball GT`,
    anilistSearch: `Dragon Ball GT`,
    fastSample: true,
  },
  {
    title: `JoJo's Bizarre Adventure: Phantom Blood`,
    anilistSearch: `JoJo no Kimyou na Bouken`,
    fastSample: true,
  },
  {
    title: `JoJo's Bizarre Adventure: Battle Tendency`,
    anilistSearch: `JoJo no Kimyou na Bouken`,
    fastSample: true,
  },
  {
    title: `The Colors`,
    anilistSearch: `Irozuku no Sekai`,
    fastSample: true,
  },
  {
    title: `Blue Box`,
    anilistSearch: `Blue Box`,
    fastSample: true,
  },
  {
    title: `Witch Watch`,
    anilistSearch: `Witch Watch`,
    fastSample: true,
  },
  {
    title: `Re:Zero`,
    anilistSearch: `Re:Zero kara Hajimeru Isekai Seikatsu`,
    fastSample: true,
  },
  {
    title: `That Time I Got Reincarnated as a Slime`,
    anilistSearch: `Tensei Shitara Slime`,
    fastSample: true,
  },
  {
    title: `KonoSuba`,
    anilistSearch: `Kono Subarashii Sekai ni Shukufuku wo`,
    fastSample: true,
  },
  {
    title: `The Rising of the Shield Hero`,
    anilistSearch: `Tate no Yuusha no Nariagari`,
    fastSample: true,
  },
  {
    title: `Kuroko no Basuke`,
    anilistSearch: `Kuroko no Basuke`,
    fastSample: true,
  },
  {
    title: `Skip and Loafer`,
    anilistSearch: `Skip to Loafer`,
    fastSample: true,
  },
  {
    title: `Ao Ashi`,
    anilistSearch: `Ao Ashi`,
    fastSample: true,
  },
  {
    title: `Junji Ito Maniac`,
    anilistSearch: `Junji Ito Maniac`,
    fastSample: true,
  },
  {
    title: `Uzumaki`,
    anilistSearch: `Uzumaki`,
    fastSample: true,
  },
  {
    title: `Shiki`,
    anilistSearch: `Shiki`,
    fastSample: true,
  },
  {
    title: `Parasyte`,
    anilistSearch: `Kiseijuu`,
    fastSample: true,
  },
  {
    title: `Evangelion`,
    anilistSearch: `Neon Genesis Evangelion`,
    fastSample: true,
  },
  {
    title: `Gundam: The Origin`,
    anilistSearch: `Kidou Senshi Gundam: The Origin`,
    fastSample: true,
  },
  {
    title: `Knights of Sidonia`,
    anilistSearch: `Sidonia no Kishi`,
    fastSample: true,
  },
  {
    title: `Ajin`,
    anilistSearch: `Ajin`,
    fastSample: true,
  },
  {
    title: `Alya Sometimes Hides Her Feelings`,
    anilistSearch: `Tokidoki Bosotto Russia-go de Dereru Tonari no Alya-san`,
    fastSample: true,
  },
  {
    title: `Frieren: Beyond Journey's End`,
    anilistSearch: `Sousou no Frieren`,
    fastSample: true,
  },
  {
    title: `Oshi no Ko`,
    anilistSearch: `【推しの子】`,
  },
  {
    title: `Bakuman!!`,
    anilistSearch: `Bakuman`,
  },
  {
    title: `Bleach`,
    anilistSearch: `Bleach`,
  },
  {
    title: `Inuyasha`,
    anilistSearch: `InuYasha`,
  },
  {
    title: `Ranma 1/2`,
    anilistSearch: `Ranma ½`,
  },
  {
    title: `Solanin`,
    anilistSearch: `Solanin`,
  },
  {
    title: `All You Need Is Kill`,
    anilistSearch: `All You Need Is Kill`,
  },
  {
    title: `Dragon Head`,
    anilistSearch: `Dragon Head`,
  },
  {
    title: `Biomega`,
    anilistSearch: `Biomega`,
  },
  {
    title: `Devilman`,
    anilistSearch: `Devilman`,
  },
  {
    title: `Cutie Honey`,
    anilistSearch: `Cutie Honey`,
  },
  {
    title: `Cyborg 009`,
    anilistSearch: `Cyborg 009`,
  },
  {
    title: `Kikaider`,
    anilistSearch: `Kikaider`,
  },
  {
    title: `Skeleton Knight in Another World`,
    anilistSearch: `Skeleton Knight in Another World`,
  },
  {
    title: `I'm the Villainess, So I'm Taming the Final Boss`,
    anilistSearch: `I'm the Villainess, So I'm Taming the Final Boss`,
  },
  {
    title: `The Magical Revolution of the Reincarnated Princess`,
    anilistSearch: `The Magical Revolution of the Reincarnated Princess`,
  },
  {
    title: `Villains Are Destined to Die`,
    anilistSearch: `Villains Are Destined to Die`,
  },
  {
    title: `The Apothecary Diaries`,
    anilistSearch: `The Apothecary Diaries`,
  },
  {
    title: `Spice and Wolf`,
    anilistSearch: `Spice and Wolf`,
  },
  {
    title: `Log Horizon`,
    anilistSearch: `Log Horizon`,
  },
  {
    title: `DanMachi`,
    anilistSearch: `Dungeon ni Deai wo Motomeru no wa Machigatteiru Darou ka`,
  },
  {
    title: `I Saved Too Many Girls and Caused the Apocalypse`,
    anilistSearch: `Ore ga Heroine wo Tasukesugite`,
    mangadexId: 'c3ee1744-9db7-4e78-984a-0d05791104a7',
    malId: 41301,
    verified: true,
    mangadexChapters: 33,
    mangadexStatus: 'completed',
    groundTruth: 'mangadex',
  },
  {
    title: `My Next Life as a Villainess`,
    anilistSearch: `My Next Life as a Villainess`,
  },
  {
    title: `Ascendance of a Bookworm`,
    anilistSearch: `Ascendance of a Bookworm`,
  },
  {
    title: `Accomplishments of the Duke's Daughter`,
    anilistSearch: `Accomplishments of the Duke's Daughter`,
  },
  {
    title: `Tearmoon Empire Story`,
    anilistSearch: `Tearmoon Empire Story`,
  },
  {
    title: `The Executioner and Her Way of Life`,
    anilistSearch: `The Executioner and Her Way of Life`,
  },
  {
    title: `I'm in Love with the Villainess`,
    anilistSearch: `I'm in Love with the Villainess`,
  },
  {
    title: `The Great Cleric`,
    anilistSearch: `The Great Cleric`,
  },
  {
    title: `Farming Life in Another World`,
    anilistSearch: `Farming Life in Another World`,
  },
  {
    title: `By the Grace of the Gods`,
    anilistSearch: `By the Grace of the Gods`,
  },
  {
    title: `I've Been Killing Slimes for 300 Years`,
    anilistSearch: `I've Been Killing Slimes for 300 Years`,
  },
  {
    title: `Negima!`,
    anilistSearch: `Negima!`,
  },
  {
    title: `Fruits Basket`,
    anilistSearch: `Fruits Basket`,
  },
  {
    title: `Tokyo Ghoul:re`,
    anilistSearch: `Tokyo Ghoul re`,
  },
  {
    title: `Space Brothers`,
    anilistSearch: `Space Brothers`,
  },
  {
    title: `Your Lie in April`,
    anilistSearch: `Shigatsu wa Kimi no Uso`,
  },
  {
    title: `A Town Where You Live`,
    anilistSearch: `A Town Where You Live`,
  },
  {
    title: `Suzuka`,
    anilistSearch: `Suzuka`,
  },
  {
    title: `Pastel`,
    anilistSearch: `Pastel`,
  },
  {
    title: `Maison Ikkoku`,
    anilistSearch: `Maison Ikkoku`,
  },
  {
    title: `Mermaid Saga`,
    anilistSearch: `Mermaid Saga`,
  },
  {
    title: `One Pound Gospel`,
    anilistSearch: `One Pound Gospel`,
  },
  {
    title: `Desert Punk`,
    anilistSearch: `Desert Punk`,
  },
  {
    title: `Air Gear`,
    anilistSearch: `Air Gear`,
  },
  {
    title: `Tsubasa: Reservoir Chronicle`,
    anilistSearch: `Tsubasa: Reservoir Chronicle`,
  },
  {
    title: `xxxHolic`,
    anilistSearch: `xxxHolic`,
  },
  {
    title: `Bunny Drop`,
    anilistSearch: `Bunny Drop`,
  },
  {
    title: `No. 6`,
    anilistSearch: `No. 6`,
  },
  {
    title: `Until the Full Moon`,
    anilistSearch: `Until the Full Moon`,
  },
  {
    title: `Shadow Star`,
    anilistSearch: `Shadow Star`,
  },
  {
    title: `Old Boy`,
    anilistSearch: `Old Boy`,
  },
  {
    title: `MPD Psycho`,
    anilistSearch: `MPD Psycho`,
  },
  {
    title: `The Kurosagi Corpse Delivery Service`,
    anilistSearch: `The Kurosagi Corpse Delivery Service`,
  },
  {
    title: `Crayon Shin-chan`,
    anilistSearch: `Crayon Shin-chan`,
  },
  {
    title: `Lady Snowblood`,
    anilistSearch: `Lady Snowblood`,
  },
  {
    title: `Path of the Assassin`,
    anilistSearch: `Path of the Assassin`,
  },
  {
    title: `Samurai Executioner`,
    anilistSearch: `Samurai Executioner`,
  },
  {
    title: `Wedding Peach`,
    anilistSearch: `Wedding Peach`,
  },
  {
    title: `Vampire Hunter D`,
    anilistSearch: `Vampire Hunter D`,
  },
  {
    title: `Ghost Talker's Daydream`,
    anilistSearch: `Ghost Talker's Daydream`,
  },
  {
    title: `Reiko the Zombie Shop`,
    anilistSearch: `Reiko the Zombie Shop`,
  },
  {
    title: `Mail`,
    anilistSearch: `Mail`,
  },
  {
    title: `The Devil's Apprentice`,
    anilistSearch: `The Devil's Apprentice`,
  },
  {
    title: `Project K`,
    anilistSearch: `Project K`,
  },
  {
    title: `Monster Girl Encyclopedia`,
    anilistSearch: `Monster Girl Encyclopedia`,
    dataCeiling: true,
  },
  {
    title: `Monster Musume`,
    anilistSearch: `Monster Musume`,
  },
  {
    title: `A Centaur's Life`,
    anilistSearch: `A Centaur's Life`,
  },
  {
    title: `Interviews With Monster Girls`,
    anilistSearch: `Interviews With Monster Girls`,
  },
  {
    title: `Kiss Him, Not Me`,
    anilistSearch: `Kiss Him, Not Me`,
  },
  {
    title: `Love in Hell`,
    anilistSearch: `Jigokuren Love in the Hell`,
    mangadexId: 'a633d659-1048-4f0c-969f-3a0d70308e06',
    malId: 30977,
    verified: true,
    mangadexChapters: 18,
    mangadexStatus: 'completed',
    groundTruth: 'mangadex',
  },
  {
    title: `Hell's Kitchen`,
    anilistSearch: `Hell's Kitchen`,
  },
  {
    title: `Death March to the Parallel World Rhapsody`,
    anilistSearch: `Death March to the Parallel World Rhapsody`,
  },
  {
    title: `Grimgar of Fantasy and Ash`,
    anilistSearch: `Grimgar of Fantasy and Ash`,
  },
  {
    title: `Bodacious Space Pirates`,
    anilistSearch: `Bodacious Space Pirates`,
  },
  {
    title: `Harukana Receive`,
    anilistSearch: `Harukana Receive`,
  },
  {
    title: `Two Car`,
    anilistSearch: `Two Car`,
    dataCeiling: true,
  },
  {
    title: `Slime Life`,
    anilistSearch: `Slime Life`,
  },
  {
    title: `Save Me in My Dream`,
    anilistSearch: `Save Me in My Dream`,
    dataCeiling: true,
  },
  {
    title: `My Girlfriend is a T-Rex`,
    anilistSearch: `My Girlfriend is a T-Rex`,
  },
  {
    title: `A Sister's All You Need`,
    anilistSearch: `A Sister's All You Need`,
  },
  {
    title: `Outbreak Company`,
    anilistSearch: `Outbreak Company`,
  },
  {
    title: `Tomodachi no Imouto ga Ore ni Dake Uzai`,
    anilistSearch: `Tomodachi no Imouto ga Ore ni dake Uzai`,
    mangadexId: '61e5da82-16ac-421e-9fcd-2db8995031a3',
    malId: 123632,
    verified: true,
    mangadexChapters: 34,
    mangadexStatus: 'ongoing',
    groundTruth: 'mangadex',
  },
  {
    title: `When I Got Home, My Girlfriend Was Already There`,
    anilistSearch: `When I Got Home, My Girlfriend Was Already There`,
    dataCeiling: true,
  },
  {
    title: `My Little Sister Stole My Fiance`,
    anilistSearch: `My Little Sister Stole My Fiance`,
  },
  {
    title: `I Want to Hold Your Hand`,
    anilistSearch: `I Want to Hold Your Hand`,
  },
  {
    title: `Girl Friends`,
    anilistSearch: `Girl Friends`,
  },
  {
    title: `Kase-san and Morning Glories`,
    anilistSearch: `Asagao to Kase-san`,
    mangadexId: '8d612ce8-2d6f-464b-8d0d-98c0352cc146',
    malId: 38105,
    verified: true,
    mangadexChapters: 65,
    mangadexStatus: 'ongoing',
    groundTruth: 'mangadex',
  },
  {
    title: `Smut`,
    anilistSearch: `Smut`,
    dataCeiling: true,
  },
  {
    title: `How to Build a Dungeon`,
    anilistSearch: `How to Build a Dungeon`,
  },
  {
    title: `We Are Betting on the End of the World`,
    anilistSearch: `Sekai no Owari ni Shiba Inu to`,
    mangadexId: '0861e776-968f-4549-847b-7e33c6d6555e',
    malId: 116765,
    verified: true,
    mangadexChapters: 43,
    mangadexStatus: 'ongoing',
    groundTruth: 'mangadex',
  },
  {
    title: `Shirokuma Cafe`,
    anilistSearch: `Shirokuma Cafe`,
  },
  {
    title: `Toukyou Akazukin`,
    anilistSearch: `Toukyou Akazukin`,
  },
  {
    title: `Mobile Suit Gundam: The Origin`,
    anilistSearch: `Mobile Suit Gundam: The Origin`,
  },
  {
    title: `Peepo Choo`,
    anilistSearch: `Peepo Choo`,
  },
  {
    title: `Message to Adolf`,
    anilistSearch: `Message to Adolf`,
  },
  {
    title: `GoGo Monster`,
    anilistSearch: `GoGo Monster`,
  },
  {
    title: `Sunny`,
    anilistSearch: `Sunny`,
  },
  {
    title: `Takemitsuzamurai`,
    anilistSearch: `Takemitsuzamurai`,
  },
  {
    title: `Kiseijuu`,
    anilistSearch: `Kiseijuu`,
  },
  {
    title: `Historie`,
    anilistSearch: `Historie`,
  },
  {
    title: `Real`,
    anilistSearch: `Real`,
  },
  {
    title: `Vagabond`,
    anilistSearch: `Vagabond`,
  },
  {
    title: `Bakuman`,
    anilistSearch: `Bakuman`,
  },
  {
    title: `Dead Dead Demon's Dededede Destruction`,
    anilistSearch: `Dead Dead Demon's Dededede Destruction`,
  },
  {
    title: `Sickness Unto Death`,
    anilistSearch: `Sickness Unto Death`,
  },
  {
    title: `Her Magic`,
    anilistSearch: `Her Magic`,
  },
  {
    title: `Whistle!`,
    anilistSearch: `Whistle!`,
  },
  {
    title: `Crimson Spell`,
    anilistSearch: `Crimson Spell`,
  },
  {
    title: `Hana Kimi`,
    anilistSearch: `Hana Kimi`,
  },
  {
    title: `Baby and Me`,
    anilistSearch: `Baby and Me`,
  },
  {
    title: `Mekakucity Actors`,
    anilistSearch: `Mekakucity Actors`,
  },
  {
    title: `Kagerou Daze`,
    anilistSearch: `Kagerou Daze`,
  },
  {
    title: `Durarara!!`,
    anilistSearch: `Durarara!!`,
  },
  {
    title: `Baccano!`,
    anilistSearch: `Baccano!`,
  },
  {
    title: `Vamp!`,
    anilistSearch: `Vamp!`,
  },
  {
    title: `E & E`,
    anilistSearch: `E & E`,
  },
  {
    title: `The 13th Boy`,
    anilistSearch: `The 13th Boy`,
  },
  {
    title: `Game Over`,
    anilistSearch: `Game Over`,
  },
  {
    title: `Embrace`,
    anilistSearch: `Embrace`,
  },
  {
    title: `Blue Wars`,
    anilistSearch: `Blue Wars`,
  },
  {
    title: `Summer Wars`,
    anilistSearch: `Summer Wars`,
  },
  {
    title: `Wolf Children`,
    anilistSearch: `Wolf Children`,
  },
  {
    title: `The Boy and the Beast`,
    anilistSearch: `The Boy and the Beast`,
  },
  {
    title: `Mirai`,
    anilistSearch: `Mirai`,
  },
  {
    title: `Ride Your Wave`,
    anilistSearch: `Ride Your Wave`,
  },
  {
    title: `Weathering with You`,
    anilistSearch: `Weathering with You`,
  },
  {
    title: `Suzume`,
    anilistSearch: `Suzume`,
  },
  {
    title: `The Boy and the Heron`,
    anilistSearch: `The Boy and the Heron`,
  },
  {
    title: `How a Realist Hero Rebuilt the Kingdom`,
    anilistSearch: `How a Realist Hero Rebuilt the Kingdom`,
  },
  {
    title: `The Hidden Dungeon Only I Can Enter`,
    anilistSearch: `The Hidden Dungeon Only I Can Enter`,
  },
  {
    title: `The Angel's Next Door Treats Me Like a Child`,
    anilistSearch: `The Angel's Next Door Treats Me Like a Child`,
  },
  {
    title: `The Magic in This Other World Is Too Far Behind!`,
    anilistSearch: `The Magic in This Other World Is Too Far Behind`,
  },
  {
    title: `I Was Reincarnated as a`,
    anilistSearch: `I Was Reincarnated as a`,
  },
  {
    title: `The Detective Is Already Dead`,
    anilistSearch: `The Detective Is Already Dead`,
  },
  {
    title: `Drugstore in Another World`,
    anilistSearch: `Drugstore in Another World`,
  },
  {
    title: `I'm the Great Immortal`,
    anilistSearch: `I'm the Great Immortal`,
  },
  {
    title: `The Servant of the Ultimate Party`,
    anilistSearch: `The Servant of the Ultimate Party`,
  },
  {
    title: `My Isekai Life`,
    anilistSearch: `My Isekai Life`,
  },
  {
    title: `Reborn to Master the Blade`,
    anilistSearch: `Reborn to Master the Blade`,
  },
  {
    title: `The Unwanted Undead Adventurer`,
    anilistSearch: `The Unwanted Undead Adventurer`,
  },
  {
    title: `Black Summoner`,
    anilistSearch: `Black Summoner`,
  },
  {
    title: `The Dream Hunter`,
    anilistSearch: `The Dream Hunter`,
  },
  {
    title: `New Life+: Young Again in This World`,
    anilistSearch: `New Life+: Young Again in This World`,
  },
  {
    title: `The Magician Who Rose From Failure`,
    anilistSearch: `The Magician Who Rose From Failure`,
  },
  {
    title: `The Most Heretical Last Boss Queen`,
    anilistSearch: `The Most Heretical Last Boss Queen`,
  },
  {
    title: `The Villainess Reverses the Hourglass`,
    anilistSearch: `The Villainess Reverses the Hourglass`,
  },
  {
    title: `The Tyrant's Only Fragrance`,
    anilistSearch: `The Tyrant's Only Fragrance`,
  },
  {
    title: `The Perks of Being a Villainess`,
    anilistSearch: `The Perks of Being a Villainess`,
  },
  {
    title: `The Evil Lady's Hero`,
    anilistSearch: `The Evil Lady's Hero`,
  },
  {
    title: `The Villainess Turns the Hourglass`,
    anilistSearch: `The Villainess Turns the Hourglass`,
  },
  {
    title: `The Villainess's Slave`,
    anilistSearch: `The Villainess's Slave`,
  },
  {
    title: `The Villainess's Butler`,
    anilistSearch: `The Villainess's Butler`,
  },
  {
    title: `The Villainess's Maid`,
    anilistSearch: `The Villainess's Maid`,
  },
  {
    title: `The Villainess's Daughter`,
    anilistSearch: `The Villainess's Daughter`,
  },
  {
    title: `The Villainess's Sister`,
    anilistSearch: `The Villainess's Sister`,
  },
  {
    title: `Black Jack`,
    anilistSearch: `Black Jack`,
  },
  {
    title: `Phoenix`,
    anilistSearch: `Phoenix`,
  },
  {
    title: `Buddha`,
    anilistSearch: `Buddha`,
  },
  {
    title: `Adolf`,
    anilistSearch: `Adolf`,
  },
  {
    title: `Lifework`,
    anilistSearch: `Lifework`,
  },
  {
    title: `Apollo's Song`,
    anilistSearch: `Apollo's Song`,
  },
  {
    title: `Ode to Kirihito`,
    anilistSearch: `Ode to Kirihito`,
  },
  {
    title: `Dr. Thorndyke`,
    anilistSearch: `Dr. Thorndyke`,
  },
  {
    title: `The Book of Human Insects`,
    anilistSearch: `The Book of Human Insects`,
  },
  {
    title: `MW`,
    anilistSearch: `MW`,
  },
  {
    title: `Ayako`,
    anilistSearch: `Ayako`,
  },
  {
    title: `Barbara`,
    anilistSearch: `Barbara`,
  },
  {
    title: `A History of Mr. Strange`,
    anilistSearch: `A History of Mr. Strange`,
  },
  {
    title: `Nezumi no Inu`,
    anilistSearch: `Nezumi no Inu`,
  },
  {
    title: `Golgo 13`,
    anilistSearch: `Golgo 13`,
  },
  {
    title: `Crying Freeman`,
    anilistSearch: `Crying Freeman`,
  },
  {
    title: `Sanctuary`,
    anilistSearch: `Sanctuary`,
  },
  {
    title: `Mai the Psychic Girl`,
    anilistSearch: `Mai the Psychic Girl`,
  },
  {
    title: `First President of Japan`,
    anilistSearch: `First President of Japan`,
  },
  {
    title: `Heat`,
    anilistSearch: `Heat`,
  },
  {
    title: `Rising Sun`,
    anilistSearch: `Rising Sun`,
  },
  {
    title: `Kodoku no Gourmet`,
    anilistSearch: `Kodoku no Gourmet`,
  },
  {
    title: `Tobo!`,
    anilistSearch: `Tobo!`,
  },
  {
    title: `Secret Comics Japan`,
    anilistSearch: `Secret Comics Japan`,
  },
  {
    title: `Japan`,
    anilistSearch: `Japan`,
  },
  {
    title: `Drawn & Quarterly`,
    anilistSearch: `Drawn & Quarterly`,
  },
  {
    title: `Nodame Cantabile`,
    anilistSearch: `Nodame Cantabile`,
  },
  {
    title: `Honey and Clover`,
    anilistSearch: `Honey and Clover`,
  },
  {
    title: `What's Michael?`,
    anilistSearch: `What's Michael?`,
  },
  {
    title: `Club 9`,
    anilistSearch: `Club 9`,
  },
  {
    title: `Ikigami`,
    anilistSearch: `Ikigami`,
  },
  {
    title: `Kurosagi Corpse Delivery Service`,
    anilistSearch: `Kurosagi Corpse Delivery Service`,
  },
  {
    title: `The Ring`,
    anilistSearch: `The Ring`,
  },
  {
    title: `Spiral`,
    anilistSearch: `Spiral`,
  },
  {
    title: `Dark Water`,
    anilistSearch: `Dark Water`,
  },
  {
    title: `Birthday`,
    anilistSearch: `Birthday`,
  },
  {
    title: `The Sling`,
    anilistSearch: `The Sling`,
  },
  {
    title: `Loop`,
    anilistSearch: `Loop`,
  },
  {
    title: `Sadako vs. Kayako`,
    anilistSearch: `Sadako vs. Kayako`,
  },
  {
    title: `J-Horror`,
    anilistSearch: `J-Horror`,
  },
  {
    title: `Gyo`,
    anilistSearch: `Gyo`,
  },
  {
    title: `Tomie`,
    anilistSearch: `Tomie`,
  },
  {
    title: `Shiver`,
    anilistSearch: `Shiver`,
  },
  {
    title: `Fragments of Horror`,
    anilistSearch: `Fragments of Horror`,
  },
  {
    title: `Shinichi Koshi`,
    anilistSearch: `Shinichi Koshi`,
  },
  {
    title: `Venus in the Blind Spot`,
    anilistSearch: `Venus in the Blind Spot`,
  },
  {
    title: `Soichi`,
    anilistSearch: `Soichi`,
  },
  {
    title: `Smashed`,
    anilistSearch: `Smashed`,
  },
  {
    title: `Deserter`,
    anilistSearch: `Deserter`,
  },
  {
    title: `Black Paradox`,
    anilistSearch: `Black Paradox`,
  },
  {
    title: `The Art of Junji Ito`,
    anilistSearch: `The Art of Junji Ito`,
  },
  {
    title: `Mimi's Tales of Terror`,
    anilistSearch: `Mimi's Tales of Terror`,
  },
  {
    title: `Voices in the Dark`,
    anilistSearch: `Voices in the Dark`,
  },
  {
    title: `Fishbone`,
    anilistSearch: `Fishbone`,
  },
  {
    title: `The Sad Tale of the Principal Post`,
    anilistSearch: `The Sad Tale of the Principal Post`,
  },
  {
    title: `The Bloody Interval`,
    anilistSearch: `The Bloody Interval`,
  },
  {
    title: `The Enigma of Amigara Fault`,
    anilistSearch: `The Enigma of Amigara Fault`,
  },
  {
    title: `The Town Without Streets`,
    anilistSearch: `The Town Without Streets`,
  },
  {
    title: `The Anatomy of a Woman`,
    anilistSearch: `The Anatomy of a Woman`,
  },
  {
    title: `The Death of a Cartographer`,
    anilistSearch: `The Death of a Cartographer`,
  },
  {
    title: `The Window Next Door`,
    anilistSearch: `The Window Next Door`,
  },
  {
    title: `The Red Cord`,
    anilistSearch: `The Red Cord`,
  },
  {
    title: `The Bully`,
    anilistSearch: `The Bully`,
  },
  {
    title: `The Summer of Ghosts`,
    anilistSearch: `The Summer of Ghosts`,
  },
  {
    title: `The Long Dream`,
    anilistSearch: `The Long Dream`,
  },
  {
    title: `The Supernatural Transfer Student`,
    anilistSearch: `The Supernatural Transfer Student`,
  },
  {
    title: `The Vampire Beauty`,
    anilistSearch: `The Vampire Beauty`,
  },
  {
    title: `The Haunted House`,
    anilistSearch: `The Haunted House`,
  },
  {
    title: `The Ghost of Golden Time`,
    anilistSearch: `The Ghost of Golden Time`,
  },
  {
    title: `The Hanging Balloons`,
    anilistSearch: `The Hanging Balloons`,
  },
  {
    title: `The Story of the Mysterious Tunnel`,
    anilistSearch: `The Story of the Mysterious Tunnel`,
  },
  {
    title: `The Story of the Impossible Staircase`,
    anilistSearch: `The Story of the Impossible Staircase`,
  },
  {
    title: `The Story of the Strange Room`,
    anilistSearch: `The Story of the Strange Room`,
  },
  {
    title: `The Story of the Mirror`,
    anilistSearch: `The Story of the Mirror`,
  },
  {
    title: `The Story of the Portrait`,
    anilistSearch: `The Story of the Portrait`,
  },
  {
    title: `The Story of the Doll`,
    anilistSearch: `The Story of the Doll`,
  },
  {
    title: `The Story of the Painting`,
    anilistSearch: `The Story of the Painting`,
  },
  {
    title: `The Story of the Statue`,
    anilistSearch: `The Story of the Statue`,
  },
  {
    title: `The Story of the Photograph`,
    anilistSearch: `The Story of the Photograph`,
  },
  {
    title: `The Story of the Film`,
    anilistSearch: `The Story of the Film`,
  },
  {
    title: `The Story of the Video`,
    anilistSearch: `The Story of the Video`,
  },
  {
    title: `The Story of the Computer`,
    anilistSearch: `The Story of the Computer`,
  },
  {
    title: `The Story of the Internet`,
    anilistSearch: `The Story of the Internet`,
  },
  {
    title: `The Story of the Phone`,
    anilistSearch: `The Story of the Phone`,
  },
  {
    title: `The Story of the Television`,
    anilistSearch: `The Story of the Television`,
  },
  {
    title: `The Story of the Radio`,
    anilistSearch: `The Story of the Radio`,
  },
  {
    title: `The Story of the Newspaper`,
    anilistSearch: `The Story of the Newspaper`,
  },
  {
    title: `The Story of the Magazine`,
    anilistSearch: `The Story of the Magazine`,
  },
  {
    title: `The Story of the Book`,
    anilistSearch: `The Story of the Book`,
  },
  {
    title: `The Story of the Letter`,
    anilistSearch: `The Story of the Letter`,
  },
  {
    title: `The Story of the Diary`,
    anilistSearch: `The Story of the Diary`,
  },
  {
    title: `The Story of the Journal`,
    anilistSearch: `The Story of the Journal`,
  },
  {
    title: `The Story of the Memoir`,
    anilistSearch: `The Story of the Memoir`,
  },
  {
    title: `The Story of the Autobiography`,
    anilistSearch: `The Story of the Autobiography`,
  },
  {
    title: `The Story of the Biography`,
    anilistSearch: `The Story of the Biography`,
  },
  {
    title: `The Story of the History`,
    anilistSearch: `The Story of the History`,
  },
  {
    title: `The Story of the Chronicle`,
    anilistSearch: `The Story of the Chronicle`,
  },
  {
    title: `The Story of the Record`,
    anilistSearch: `The Story of the Record`,
  },
  {
    title: `The Story of the Report`,
    anilistSearch: `The Story of the Report`,
  },
  {
    title: `The Story of the Account`,
    anilistSearch: `The Story of the Account`,
  },
  {
    title: `The Story of the Narrative`,
    anilistSearch: `The Story of the Narrative`,
  },
  {
    title: `The Story of the Tale`,
    anilistSearch: `The Story of the Tale`,
  },
  {
    title: `The Story of the Legend`,
    anilistSearch: `The Story of the Legend`,
  },
  {
    title: `The Story of the Myth`,
    anilistSearch: `The Story of the Myth`,
  },
  {
    title: `The Story of the Fable`,
    anilistSearch: `The Story of the Fable`,
  },
  {
    title: `The Story of the Parable`,
    anilistSearch: `The Story of the Parable`,
  },
  {
    title: `The Story of the Allegory`,
    anilistSearch: `The Story of the Allegory`,
  },
  {
    title: `The Story of the Metaphor`,
    anilistSearch: `The Story of the Metaphor`,
  },
  {
    title: `The Story of the Simile`,
    anilistSearch: `The Story of the Simile`,
  },
  {
    title: `The Story of the Symbol`,
    anilistSearch: `The Story of the Symbol`,
  },
  {
    title: `The Story of the Sign`,
    anilistSearch: `The Story of the Sign`,
  },
  {
    title: `The Story of the Omen`,
    anilistSearch: `The Story of the Omen`,
  },
  {
    title: `The Story of the Portent`,
    anilistSearch: `The Story of the Portent`,
  },
  {
    title: `The Story of the Prodigy`,
    anilistSearch: `The Story of the Prodigy`,
  },
  {
    title: `The Story of the Miracle`,
    anilistSearch: `The Story of the Miracle`,
  },
  {
    title: `The Story of the Wonder`,
    anilistSearch: `The Story of the Wonder`,
  },
  {
    title: `The Story of the Marvel`,
    anilistSearch: `The Story of the Marvel`,
  },
  {
    title: `The Story of the Phenomenon`,
    anilistSearch: `The Story of the Phenomenon`,
  },
  {
    title: `The Story of the Mystery`,
    anilistSearch: `The Story of the Mystery`,
  },
  {
    title: `The Story of the Puzzle`,
    anilistSearch: `The Story of the Puzzle`,
  },
  {
    title: `The Story of the Riddle`,
    anilistSearch: `The Story of the Riddle`,
  },
  {
    title: `The Story of the Secret`,
    anilistSearch: `The Story of the Secret`,
  },
  {
    title: `The Story of the Enigma`,
    anilistSearch: `The Story of the Enigma`,
  },
  {
    title: `The Story of the Paradox`,
    anilistSearch: `The Story of the Paradox`,
  },
  {
    title: `The Story of the Contradiction`,
    anilistSearch: `The Story of the Contradiction`,
  },
  {
    title: `The Story of the Irony`,
    anilistSearch: `The Story of the Irony`,
  },
  {
    title: `The Story of the Satire`,
    anilistSearch: `The Story of the Satire`,
  },
  {
    title: `The Story of the Parody`,
    anilistSearch: `The Story of the Parody`,
  },
  {
    title: `The Story of the Spoof`,
    anilistSearch: `The Story of the Spoof`,
  },
  {
    title: `The Story of the Farce`,
    anilistSearch: `The Story of the Farce`,
  },
  {
    title: `The Story of the Comedy`,
    anilistSearch: `The Story of the Comedy`,
  },
  {
    title: `The Story of the Tragedy`,
    anilistSearch: `The Story of the Tragedy`,
  },
  {
    title: `The Story of the Drama`,
    anilistSearch: `The Story of the Drama`,
  },
  {
    title: `The Story of the Romance`,
    anilistSearch: `The Story of the Romance`,
  },
  {
    title: `The Story of the Adventure`,
    anilistSearch: `The Story of the Adventure`,
  },
  {
    title: `The Story of the Quest`,
    anilistSearch: `The Story of the Quest`,
  },
  {
    title: `The Story of the Journey`,
    anilistSearch: `The Story of the Journey`,
  },
  {
    title: `The Story of the Voyage`,
    anilistSearch: `The Story of the Voyage`,
  },
  {
    title: `The Story of the Expedition`,
    anilistSearch: `The Story of the Expedition`,
  },
  {
    title: `The Story of the Exploration`,
    anilistSearch: `The Story of the Exploration`,
  },
  {
    title: `The Story of the Discovery`,
    anilistSearch: `The Story of the Discovery`,
  },
  {
    title: `The Story of the Invention`,
    anilistSearch: `The Story of the Invention`,
  },
  {
    title: `The Story of the Creation`,
    anilistSearch: `The Story of the Creation`,
  },
  {
    title: `The Story of the Origin`,
    anilistSearch: `The Story of the Origin`,
  },
  {
    title: `The Story of the Beginning`,
    anilistSearch: `The Story of the Beginning`,
  },
  {
    title: `The Story of the End`,
    anilistSearch: `The Story of the End`,
  },
  {
    title: `The Story of the Conclusion`,
    anilistSearch: `The Story of the Conclusion`,
  },
  {
    title: `The Story of the Finale`,
    anilistSearch: `The Story of the Finale`,
  },
  {
    title: `The Story of the Epilogue`,
    anilistSearch: `The Story of the Epilogue`,
  },
  {
    title: `The Story of the Prologue`,
    anilistSearch: `The Story of the Prologue`,
  },
  {
    title: `The Story of the Prelude`,
    anilistSearch: `The Story of the Prelude`,
  },
  {
    title: `The Story of the Introduction`,
    anilistSearch: `The Story of the Introduction`,
  },
  {
    title: `The Story of the Exposition`,
    anilistSearch: `The Story of the Exposition`,
  },
  {
    title: `The Story of the Rising Action`,
    anilistSearch: `The Story of the Rising Action`,
  },
  {
    title: `The Story of the Climax`,
    anilistSearch: `The Story of the Climax`,
  },
  {
    title: `The Story of the Falling Action`,
    anilistSearch: `The Story of the Falling Action`,
  },
  {
    title: `The Story of the Resolution`,
    anilistSearch: `The Story of the Resolution`,
  },
  {
    title: `The Story of the Denouement`,
    anilistSearch: `The Story of the Denouement`,
  },
  {
    title: `The Story of the Aftermath`,
    anilistSearch: `The Story of the Aftermath`,
  },
  {
    title: `The Story of the Sequel`,
    anilistSearch: `The Story of the Sequel`,
  },
  {
    title: `The Story of the Prequel`,
    anilistSearch: `The Story of the Prequel`,
  },
  {
    title: `The Story of the Spin-off`,
    anilistSearch: `The Story of the Spin-off`,
  },
  {
    title: `The Story of the Side Story`,
    anilistSearch: `The Story of the Side Story`,
  },
  {
    title: `The Story of the Bonus Chapter`,
    anilistSearch: `The Story of the Bonus Chapter`,
  },
  {
    title: `The Story of the Extra Chapter`,
    anilistSearch: `The Story of the Extra Chapter`,
  },
  {
    title: `The Story of the Special Chapter`,
    anilistSearch: `The Story of the Special Chapter`,
  },
  {
    title: `The Story of the One-shot`,
    anilistSearch: `The Story of the One-shot`,
  },
  {
    title: `The Story of the Volume 0`,
    anilistSearch: `The Story of the Volume 0`,
  },
  {
    title: `The Story of the Chapter 0`,
    anilistSearch: `The Story of the Chapter 0`,
  },
  {
    title: `The Story of the Episode 0`,
    anilistSearch: `The Story of the Episode 0`,
  },
  {
    title: `The Story of the Prologue Episode`,
    anilistSearch: `The Story of the Prologue Episode`,
  },
  {
    title: `The Story of the Epilogue Episode`,
    anilistSearch: `The Story of the Epilogue Episode`,
  },
];
