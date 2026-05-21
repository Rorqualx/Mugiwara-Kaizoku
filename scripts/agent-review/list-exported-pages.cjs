const fs = require('fs');

const data = JSON.parse(fs.readFileSync('.claude/agent-review/pages-for-review.json', 'utf-8'));
process.stdout.write('Exported pages for review:\n');
data.pages.forEach(p => {
  const labeled = p.tokens.filter(t => t.label !== 'O').length;
  process.stdout.write(p.id + ' | ' + p.sourceType + ' | ' + labeled + ' labels | ' + p.url.substring(0, 55) + '\n');
});
