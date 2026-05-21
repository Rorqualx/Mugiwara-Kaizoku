/**
 * Test fixtures for Unified Parser tests
 */

export const FANDOM_HTML_SAMPLE = `
<!DOCTYPE html>
<html>
<head>
  <meta property="og:site_name" content="One Piece Wiki | Fandom">
  <title>One Piece</title>
</head>
<body>
  <div class="fandom-community-header"></div>
  <aside class="portable-infobox">
    <h2 class="pi-title">One Piece</h2>
    <div class="pi-item pi-data">
      <h3 class="pi-data-label">Author</h3>
      <div class="pi-data-value">Eiichiro Oda</div>
    </div>
    <div class="pi-item pi-data">
      <h3 class="pi-data-label">Publisher</h3>
      <div class="pi-data-value">Shueisha</div>
    </div>
    <div class="pi-item pi-data">
      <h3 class="pi-data-label">Magazine</h3>
      <div class="pi-data-value">Weekly Shōnen Jump</div>
    </div>
    <div class="pi-item pi-data">
      <h3 class="pi-data-label">Demographic</h3>
      <div class="pi-data-value">Shōnen</div>
    </div>
    <div class="pi-item pi-data">
      <h3 class="pi-data-label">Original run</h3>
      <div class="pi-data-value">July 22, 1997 – present</div>
    </div>
    <div class="pi-item pi-data">
      <h3 class="pi-data-label">Volumes</h3>
      <div class="pi-data-value">110</div>
    </div>
    <div class="pi-item pi-data">
      <h3 class="pi-data-label">Chapters</h3>
      <div class="pi-data-value">1100+</div>
    </div>
    <div class="pi-item pi-image">
      <img src="https://static.wikia.nocookie.net/onepiece/images/cover.jpg" 
           data-src="https://static.wikia.nocookie.net/onepiece/images/cover.jpg/revision/latest"
           alt="One Piece Cover">
    </div>
  </aside>
  
  <div class="mw-parser-output">
    <p>One Piece is a Japanese manga series written and illustrated by Eiichiro Oda.</p>
    
    <table class="wikitable">
      <thead>
        <tr>
          <th>Volume</th>
          <th>Title</th>
          <th>Chapters</th>
          <th>Release Date</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Volume 1</td>
          <td>Romance Dawn</td>
          <td>1-8</td>
          <td>December 24, 1997</td>
        </tr>
        <tr>
          <td>Volume 2</td>
          <td>Versus!! The Buggy Pirates</td>
          <td>9-17</td>
          <td>April 3, 1998</td>
        </tr>
      </tbody>
    </table>
    
    <div class="wikia-gallery">
      <div class="wikia-gallery-item">
        <img src="https://static.wikia.nocookie.net/onepiece/volume1.jpg" alt="Volume 1">
        <div class="lightbox-caption">Volume 1: Romance Dawn - Chapters 1-8</div>
      </div>
      <div class="wikia-gallery-item">
        <img src="https://static.wikia.nocookie.net/onepiece/volume2.jpg" alt="Volume 2">
        <div class="lightbox-caption">Volume 2: Versus!! The Buggy Pirates - Chapters 9-17</div>
      </div>
    </div>
    
    <div class="wds-tabber">
      <div class="wds-tabs">
        <div class="wds-tab__content">
          <table class="wikitable">
            <tr><th>Chapter</th><th>Title</th><th>Release Date</th></tr>
            <tr><td>Chapter 1</td><td>Romance Dawn</td><td>July 22, 1997</td></tr>
            <tr><td>Chapter 2</td><td>They Call Him "Straw Hat Luffy"</td><td>August 4, 1997</td></tr>
          </table>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

export const WIKIPEDIA_HTML_SAMPLE = `
<!DOCTYPE html>
<html>
<head>
  <meta name="generator" content="MediaWiki 1.40">
  <title>One Piece - Wikipedia</title>
</head>
<body>
  <div id="mw-content-text">
    <div class="mw-parser-output">
      <table class="infobox">
        <caption>One Piece</caption>
        <tbody>
          <tr>
            <th>Genre</th>
            <td>Adventure, Fantasy</td>
          </tr>
          <tr>
            <th>Written by</th>
            <td>Eiichiro Oda</td>
          </tr>
          <tr>
            <th>Published by</th>
            <td>Shueisha</td>
          </tr>
          <tr>
            <th>Magazine</th>
            <td>Weekly Shōnen Jump</td>
          </tr>
          <tr>
            <th>Original run</th>
            <td>July 22, 1997 – present</td>
          </tr>
          <tr>
            <th>Volumes</th>
            <td>110</td>
          </tr>
          <tr>
            <td colspan="2">
              <img src="//upload.wikimedia.org/wikipedia/en/thumb/onepiece.jpg/250px-onepiece.jpg" 
                   alt="One Piece">
            </td>
          </tr>
        </tbody>
      </table>
      
      <p><b>One Piece</b> is a Japanese manga series written and illustrated by Eiichiro Oda.</p>
      
      <h2>Plot</h2>
      <p>The story follows the adventures of Monkey D. Luffy, a young man whose body gained the properties of rubber after unintentionally eating a Devil Fruit.</p>
      
      <table class="wikitable">
        <caption>List of One Piece volumes</caption>
        <tbody>
          <tr>
            <th>No.</th>
            <th>Title</th>
            <th>Japanese release</th>
            <th>English release</th>
          </tr>
          <tr>
            <td>1</td>
            <td>Romance Dawn</td>
            <td>December 24, 1997</td>
            <td>June 30, 2003</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
`;

export const GALLERY_HTML_SAMPLE = `
<div class="wikia-gallery">
  <div class="wikia-gallery-item">
    <a href="/wiki/Volume_1" class="image">
      <img src="https://static.wikia.nocookie.net/manga/volume1_thumb.jpg"
           data-src="https://static.wikia.nocookie.net/manga/volume1.jpg"
           alt="Volume 1 Cover">
    </a>
    <div class="lightbox-caption">
      Volume 1: The Beginning - Chapters 1-7 - ISBN 978-1234567890
    </div>
  </div>
  <div class="wikia-gallery-item">
    <a href="/wiki/Volume_2" class="image">
      <img src="https://static.wikia.nocookie.net/manga/volume2_thumb.jpg"
           data-src="https://static.wikia.nocookie.net/manga/volume2.jpg"
           alt="Volume 2 Cover">
    </a>
    <div class="lightbox-caption">
      Volume 2: The Journey - Chapters 8-15 - Released: April 2020
    </div>
  </div>
</div>
`;

export const STORY_ARC_TABLE_HTML = `
<table class="wikitable">
  <tbody>
    <tr class="arc-header">
      <th colspan="4">East Blue Saga</th>
    </tr>
    <tr>
      <td>Chapter 1</td>
      <td>Romance Dawn</td>
      <td>Volume 1</td>
      <td>July 22, 1997</td>
    </tr>
    <tr>
      <td>Chapter 2</td>
      <td>They Call Him "Straw Hat Luffy"</td>
      <td>Volume 1</td>
      <td>August 4, 1997</td>
    </tr>
    <tr class="arc-header">
      <th colspan="4">Alabasta Saga</th>
    </tr>
    <tr>
      <td>Chapter 101</td>
      <td>Reverse Mountain</td>
      <td>Volume 12</td>
      <td>December 2, 1999</td>
    </tr>
  </tbody>
</table>
`;

export const ROWSPAN_TABLE_HTML = `
<table class="wikitable">
  <thead>
    <tr>
      <th>Volume</th>
      <th>Title</th>
      <th>Chapter</th>
      <th>Chapter Title</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td rowspan="3">Volume 1</td>
      <td rowspan="3">Romance Dawn</td>
      <td>Chapter 1</td>
      <td>Romance Dawn</td>
    </tr>
    <tr>
      <td>Chapter 2</td>
      <td>They Call Him "Straw Hat Luffy"</td>
    </tr>
    <tr>
      <td>Chapter 3</td>
      <td>Enter Zoro</td>
    </tr>
    <tr>
      <td rowspan="2">Volume 2</td>
      <td rowspan="2">Versus!! The Buggy Pirates</td>
      <td>Chapter 9</td>
      <td>Femme Fatale</td>
    </tr>
    <tr>
      <td>Chapter 10</td>
      <td>Incident at the Bar</td>
    </tr>
  </tbody>
</table>
`;

export const TABBED_CONTENT_HTML = `
<div class="wds-tabber">
  <div class="wds-tabs">
    <div class="wds-tab" data-hash="japanese-release">
      <div class="wds-tab__label">Japanese Release</div>
    </div>
    <div class="wds-tab" data-hash="english-release">
      <div class="wds-tab__label">English Release</div>
    </div>
  </div>
  <div class="wds-tab__content" data-hash="japanese-release">
    <table class="wikitable">
      <tr><th>Volume</th><th>Release Date</th><th>ISBN</th></tr>
      <tr><td>Volume 1</td><td>December 24, 1997</td><td>978-4-08-872509-3</td></tr>
      <tr><td>Volume 2</td><td>April 3, 1998</td><td>978-4-08-872544-4</td></tr>
    </table>
  </div>
  <div class="wds-tab__content" data-hash="english-release">
    <table class="wikitable">
      <tr><th>Volume</th><th>Release Date</th><th>ISBN</th></tr>
      <tr><td>Volume 1</td><td>June 30, 2003</td><td>978-1-56931-901-9</td></tr>
      <tr><td>Volume 2</td><td>November 10, 2003</td><td>978-1-59116-057-5</td></tr>
    </table>
  </div>
</div>
`;

export const EXPECTED_METADATA = {
  title: 'One Piece',
  author: ['Eiichiro Oda'],
  artist: ['Eiichiro Oda'],
  publisher: 'Shueisha',
  magazine: 'Weekly Shōnen Jump',
  demographic: 'Shōnen',
  genres: ['Adventure', 'Fantasy'],
  status: 'ONGOING',
  volumes: 110,
  chapters: 1100,
  originalRun: 'July 22, 1997 – present'
};

export const EXPECTED_VOLUMES = [
  {
    volumeNumber: 1,
    title: 'Romance Dawn',
    chapters: [
      { chapterNumber: '1', title: 'Romance Dawn' },
      { chapterNumber: '2', title: 'They Call Him "Straw Hat Luffy"' },
      { chapterNumber: '3', title: 'Enter Zoro' }
    ],
    releaseDate: 'December 24, 1997'
  },
  {
    volumeNumber: 2,
    title: 'Versus!! The Buggy Pirates',
    chapters: [
      { chapterNumber: '9', title: 'Femme Fatale' },
      { chapterNumber: '10', title: 'Incident at the Bar' }
    ],
    releaseDate: 'April 3, 1998'
  }
];

export const MALFORMED_HTML = `
<div class="portable-infobox
  <div class="pi-item>
    <h3 class="pi-data-label>Author</h3
    <div class="pi-data-value">Test Author
  </div>
</div>
<table>
  <tr>
    <td>Unclosed table
`;

export const MULTI_LANGUAGE_HTML = `
<div class="portable-infobox">
  <div class="pi-item pi-data">
    <h3 class="pi-data-label">Japanese Title</h3>
    <div class="pi-data-value">ワンピース</div>
  </div>
  <div class="pi-item pi-data">
    <h3 class="pi-data-label">Korean Title</h3>
    <div class="pi-data-value">원피스</div>
  </div>
  <div class="pi-item pi-data">
    <h3 class="pi-data-label">Volumes</h3>
    <div class="pi-data-value">第110巻</div>
  </div>
  <div class="pi-item pi-data">
    <h3 class="pi-data-label">Chapters</h3>
    <div class="pi-data-value">第1100話</div>
  </div>
  <div class="pi-item pi-data">
    <h3 class="pi-data-label">Status</h3>
    <div class="pi-data-value">連載中</div>
  </div>
</div>
`;

export const LAZY_LOADED_IMAGES = `
<div class="gallery">
  <img class="lazyload" 
       data-src="https://example.com/image1.jpg"
       data-original="https://example.com/image1_original.jpg"
       src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">
  <img data-lazy-src="https://example.com/image2.jpg"
       src="placeholder.jpg">
  <noscript>
    <img src="https://example.com/image3.jpg" alt="Fallback">
  </noscript>
</div>
`;