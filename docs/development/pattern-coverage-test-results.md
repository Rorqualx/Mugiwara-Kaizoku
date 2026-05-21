# Pattern Coverage Test Results

**Date:** 2026-03-07T21:05:40.169Z
**Pages Tested:** 85
**Successfully Fetched:** 85
**Extracted Chapters:** 68 (80.0%)
**Zero Chapters:** 17
**Fetch Failed:** 0

## Pattern Hit Frequency (Our Extractors)

| Pattern | Pages | Total Hits | Example Titles |
|---------|-------|------------|----------------|
| `F_number_in_link` | 52 | 281 | Saint Seiya - Saintia Shou, One Piece, Rumic World Trilogy |
| `H_title_attribute` | 10 | 1140 | Moriarty the Patriot, Stellar Witch LIP☆S, The Promised Neverland |
| `K_chapter_no_title` | 8 | 240 | Tsugumomo, The Promised Neverland, The Guy She Was Interested In Wasn't a Guy at All |
| `I_dash_separated` | 7 | 10 | Meow Man, Saint Seiya - Saintia Shou, One Piece |
| `L_unordered_list` | 6 | 421 | Stellar Witch LIP☆S, The Promised Neverland, The Guy She Was Interested In Wasn't a Guy at All |
| `E_unpadded_plain` | 4 | 216 | Ten Count, Moriarty the Patriot, The Promised Neverland |
| `D_padded_plain_link` | 3 | 203 | Moriarty the Patriot, The Promised Neverland, Bakemonogatari |
| `OL_ordered_list` | 2 | 9 | Log Horizon, Moriarty the Patriot |
| `G_quoted_title` | 1 | 2 | The Promised Neverland |
| `J_chapter_prefix` | 1 | 278 | Tokyo Revengers |

## Unhandled Pattern Detection (HTML Present but Not Extracted)

| Pattern | Description | Pages | Example Titles |
|---------|-------------|-------|----------------|
| `LI_SPAN_A` | <li><span><a>Title</a></span></li> | 57 | Saint Seiya - Saintia Shou, One Piece, Rumic World Trilogy, Flame of Recca |
| `TD_NUM_TD_A` | <td>N</td>...<td><a></a></td> | 10 | Saint Seiya - Saintia Shou, Boruto, RG Veda, Prince of Tennis |
| `HASH_PREFIX` | #N prefix | 8 | One Piece, Boruto, Psyren, Ballroom e Youkoso |
| `EPISODE_PREFIX` | Episode N prefix | 8 | Tsugumomo, All of Us Are Dead, The Promised Neverland, Fluffy Paradise |
| `ALT_PREFIX` | Round/Stage/Mission N | 3 | Moriarty the Patriot, Act-Age, JoJo's Bizarre Adventure Part 7 - Steel Ball Run |
| `P_NUM_A` | <p>N. <a>Title</a></p> | 1 | Ten Count |
| `QUOTED_TITLE` | N. "<a>Title</a>" | 1 | The Promised Neverland |
| `A_HASH_NUM_TITLE` | <a>#N Title</a> | 1 | Blue Box |
| `DL_DD_A` | <dl><dd><a></a></dd> | 1 | Tokyo Revengers |
| `NUM_COLON_A` | N: <a>Title</a> | 1 | Kono Oto Tomare! |
| `RUBY_TAG` | <ruby> reading aids | 1 | Kono Oto Tomare! |

## Pages With 0 Chapters Extracted (17)

### Boruto
- URL: https://boruto.fandom.com/wiki/List_of_Chapters
- Original survey patterns: TABLE_WIKITABLE, TABLE_ARTICLE, TABLE_CH_COL, TABLE_NUM_COL, TD_NUM_TD_A, HASH_PREFIX, A_TITLE_CH_VOL
- Missed patterns in HTML: TD_NUM_TD_A, HASH_PREFIX

### The Hidden Saintess
- URL: https://webtoon.fandom.com/wiki/The%20Hidden%20Saintess
- Original survey patterns: UL_LI_A, COLLAPSIBLE, NAVBOX

### Psyren
- URL: https://manga.fandom.com/wiki/List_of_Psyren_chapters
- Original survey patterns: OL_START_ATTR, TABLE_WIKITABLE, TABLE_TITLE_COL, TABLE_NUM_COL, SPAN_HEADLINE_VOL, HASH_PREFIX, LI_SPAN_A
- Missed patterns in HTML: LI_SPAN_A, HASH_PREFIX

### Ballroom e Youkoso
- URL: https://ballroomeyoukoso.fandom.com/wiki/Chapters_and_Volumes
- Original survey patterns: TABLE_NUM_COL, SPAN_HEADLINE_VOL, HASH_PREFIX
- Missed patterns in HTML: HASH_PREFIX

### Conan
- URL: https://conan.fandom.com/wiki/Conan
- Original survey patterns: UL_LI_A, CH_WORD_PREFIX, LI_SPAN_A
- Missed patterns in HTML: LI_SPAN_A

### Taste of Illness
- URL: https://webtoon.fandom.com/wiki/Taste%20of%20Illness
- Original survey patterns: COLLAPSIBLE, TABBER, NAVBOX

### Fluffy Paradise
- URL: https://fluffyparadise.fandom.com/wiki/Fluffy_Paradise
- Original survey patterns: TABLE_TITLE_COL, TABLE_NUM_COL, SPAN_HEADLINE_VOL, EPISODE_PREFIX, COLLAPSIBLE
- Missed patterns in HTML: EPISODE_PREFIX

### Act-Age
- URL: https://act-age.fandom.com/wiki/Volumes_and_Chapters
- Original survey patterns: UL_LI_A, TABLE_NUM_COL, SPAN_HEADLINE_VOL, ALT_PREFIX, HASH_PREFIX, TABBER, A_TITLE_CH_VOL, LI_SPAN_A
- Missed patterns in HTML: LI_SPAN_A, ALT_PREFIX, HASH_PREFIX

### Shugo Chara!
- URL: https://manga.fandom.com/wiki/List_of_Shugo_Chara!_volumes
- Original survey patterns: TABLE_WIKITABLE, TABLE_TITLE_COL, TABLE_NUM_COL, SPAN_HEADLINE_VOL, LI_SPAN_A
- Missed patterns in HTML: LI_SPAN_A

### Heaven?
- URL: https://manga.fandom.com/wiki/List_of_M%C3%84R_chapters
- Original survey patterns: TABLE_WIKITABLE, TABLE_NUM_COL, SPAN_HEADLINE_VOL, COLLAPSIBLE, LI_SPAN_A
- Missed patterns in HTML: LI_SPAN_A

### A Couple of Cuckoos
- URL: https://cuckoo.fandom.com/wiki/List_of_Chapters_and_Volumes
- Original survey patterns: UL_LI_A, TABLE_NUM_COL, SPAN_HEADLINE_VOL, HASH_PREFIX, TABBER, A_TITLE_CH_VOL
- Missed patterns in HTML: HASH_PREFIX

### Barakamon
- URL: https://barakamon.fandom.com/wiki/Barakamon
- Original survey patterns: TABLE_WIKITABLE, TABLE_SORTABLE, TABLE_TITLE_COL, TABLE_NUM_COL, EPISODE_PREFIX
- Missed patterns in HTML: EPISODE_PREFIX

### The Duke's Cursed Charm
- URL: https://webtoon.fandom.com/wiki/The%20Duke's%20Cursed%20Charm
- Original survey patterns: UL_LI_A, COLLAPSIBLE, TABBER, NAVBOX

### By the Grace of the Gods
- URL: https://bythegraceofthegods.fandom.com/wiki/Chapters_and_Volumes
- Original survey patterns: TABLE_ARTICLE, TABLE_CH_COL, SPAN_HEADLINE_VOL, EPISODE_PREFIX, HASH_PREFIX, SMALL_TAG
- Missed patterns in HTML: EPISODE_PREFIX, HASH_PREFIX

### Welfare Center
- URL: https://webtoon.fandom.com/wiki/Welfare%20Center
- Original survey patterns: COLLAPSIBLE, TABBER, NAVBOX

### Darwin's Game
- URL: https://darwins-game.fandom.com/wiki/Darwin's%20Game%20(series)
- Original survey patterns: A_TITLE_CH_VOL

### Kakegurui
- URL: https://kakegurui.fandom.com/wiki/List_of_Kakegurui_Volumes
- Original survey patterns: UL_LI_A, TABLE_WIKITABLE, TABLE_CH_COL, TD_NUM_TD_A, SPAN_HEADLINE_VOL, CH_WORD_PREFIX, A_TITLE_CH_VOL, LI_SPAN_A
- Missed patterns in HTML: LI_SPAN_A, TD_NUM_TD_A


## Pages With Chapters Extracted (68)

| Title | Chapters | Patterns Used | Sample Titles |
|-------|----------|---------------|---------------|
| Tokyo Revengers | 278 | F_number_in_link, H_title_attribute, J_chapter_prefix | 1: 0; 2: 0; 3: 0 |
| Blue Box | 232 | H_title_attribute, L_unordered_list | 1: #1: Chinatsu Senpai; 2: #2: You Have to Go to Nationals; 3: #3: Pretending to Be a Stranger |
| The Promised Neverland | 181 | D_padded_plain_link, E_unpadded_plain, G_quoted_title, H_title_attribute, K_chapter_no_title, L_unordered_list | 1: Grace Field House; 2: The Way Out; 3: The Iron Woman |
| Kono Oto Tomare! | 149 | H_title_attribute | 1: The New Member; 2: Where to Find Someone Qualified; 3: Our Reasons for Joining |
| Delicious in Dungeon | 97 | F_number_in_link, H_title_attribute, K_chapter_no_title, L_unordered_list | 1: 0; 2: 0; 3: 0 |
| Moriarty the Patriot | 92 | D_padded_plain_link, E_unpadded_plain, H_title_attribute, OL_ordered_list | 1: The Scarlet Eyes; 2: The One Grapefruit Pie; 3: The Dancers on the Bridge |
| Jahy-sama wa Kujikenai! | 73 | H_title_attribute, K_chapter_no_title, L_unordered_list | 0: Chapter 0.1; 1: Chapter 1; 2: Chapter 2 |
| Magical Girl Site | 55 | H_title_attribute | 1: ENTER. 1- Mahou Shoujo Site; 2: ENTER. 2- Yatsumura Tsuyuno; 3: ENTER. 3- Tempest |
| My Deer Friend Nokotan | 49 | K_chapter_no_title | 1: Chapter 1; 2: Chapter 2; 3: Chapter 3 |
| Shigatsu wa Kimi no Uso | 44 | H_title_attribute | 1: Monotone; 2: The Love of a Violinist; 3: Black Cat |
| Bakemonogatari | 30 | D_padded_plain_link, E_unpadded_plain, F_number_in_link, K_chapter_no_title | 1: 0; 2: 0; 3: Kizumonogatari |
| The Guy She Was Interested In Wasn't a Guy at All | 18 | K_chapter_no_title, L_unordered_list | 1: Chapter 1; 2: Chapter 2; 3: Chapter 3 |
| Stellar Witch LIP☆S | 11 | H_title_attribute, L_unordered_list | 1: The Sixth Witch of the Night; 2: Azure Magic; 3: The Verdant Maiden |
| Saint Seiya - Saintia Shou | 7 | F_number_in_link, I_dash_separated | 1: 0; 7: 0; 8: 0 |
| One Piece | 7 | F_number_in_link, I_dash_separated | 1: 20; 4: 0; 5: 0 |
| Prince of Tennis | 7 | F_number_in_link, I_dash_separated | 1: 4215-1650-0; 3: 0; 7: 0 |
| Ten Count | 6 | E_unpadded_plain | 1: Chapter One; 2: Chapter Two; 3: Chapter Three |
| Gantz | 5 | F_number_in_link, I_dash_separated | 1: 0; 4: 08-876735-7; 6: 0 |
| Shaman | 5 | F_number_in_link | 1: 0; 2: 0; 3: 0 |
| Rumic World Trilogy | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Flame of Recca | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Break Shot | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Wakaba Won't Give Up! | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| The Queens | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Old Boy | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| City Hunter | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Buso Renkin | 4 | F_number_in_link | 2: 0; 3: 0; 4: 0 |
| Getter Robo | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Trigun | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Cutie Honey | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Papa Told Me | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Hot Gimmick | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| True Beauty | 4 | F_number_in_link | 3: 0; 4: 0; 5: 0 |
| Sand Chronicles | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Who Wants to Marry a Billionaire | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Nana & Kaoru | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Durarara!! | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Legend of the Galactic Heroes | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Barbara | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Gamaran - Shura | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Free! | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Captain Harlock | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Kaze Hikaru | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Battle Royale | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| NOiSE | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| MM! | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Itazura na Kiss | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| March Comes in Like a Lion | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Aquarion Evol | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Ashita no Joe | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Edens Zero | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| MF Ghost | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Koko ni Iru yo! | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Nodame Cantabile | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Baccano! | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| The Game Devil | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Uzumaki | 4 | F_number_in_link | 9: 0; 10: 0; 12: 0 |
| Log Horizon | 3 | OL_ordered_list | 1: (Season 1); 2: Log Horizon 2 (Season 2); 3: Log Horizon: Destruction of the Round Table (Season 3) |
| Yotsuba&! | 3 | F_number_in_link | 5: 00; 17: 0; 26: 0 |
| RG Veda | 2 | F_number_in_link | 1: 00; 2: 00 |
| All of Us Are Dead | 2 | F_number_in_link | 4: 0; 6: 0 |
| JoJo's Bizarre Adventure Part 7 - Steel Ball Run | 2 | F_number_in_link, I_dash_separated | 1: 0; 978: 1-59116-754-9 |
| Meow Man | 1 | I_dash_separated | 3: Second Strip |
| Tsugumomo | 1 | K_chapter_no_title | 1: Chapter 1 |
| Re:Zero | 1 | K_chapter_no_title | 1: Chapter 1 |
| Heavy Object | 1 | F_number_in_link | 1: 0 |
| Boys Over Flowers | 1 | F_number_in_link | 1: 0 |
| Skeleton Knight in Another World | 1 | I_dash_separated | 978: 4865540543 |

## Summary

- Total chapters extracted across all pages: **1516**
- Average chapters per page (where > 0): **22.3**
- Coverage rate: **68/85** pages (80.0%)
