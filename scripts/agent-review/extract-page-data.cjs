const fs = require('fs');

const pageId = process.argv[2];
if (!pageId) {
  process.stderr.write('Usage: node extract-page-data.js <pageId>\n');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync('.claude/agent-review/pages-for-review.json', 'utf-8'));
const page = data.pages.find(p => p.id === pageId);

if (!page) {
  process.stderr.write('Page not found: ' + pageId + '\n');
  process.exit(1);
}

const labeled = page.tokens
  .filter(t => t.label !== 'O')
  .map(t => `[${t.index}] ${t.label}: "${t.text}"`)
  .join('\n');

process.stdout.write('URL: ' + page.url + '\n');
process.stdout.write('Source: ' + page.sourceType + '\n');
process.stdout.write('Total tokens: ' + page.tokens.length + '\n');
process.stdout.write('\nLabeled tokens:\n');
process.stdout.write((labeled || 'No labeled tokens') + '\n');

// Also output a sample of the page content (first 50 tokens)
process.stdout.write('\nPage content sample (first 50 tokens):\n');
process.stdout.write(page.tokens.slice(0, 50).map(t => t.text).join(' ') + '\n');
