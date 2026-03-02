const fs = require('fs');
const path = require('path');

function mustContain(filePath, snippets) {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const snippet of snippets) {
    if (!content.includes(snippet)) {
      throw new Error(`${filePath} is missing expected snippet: ${snippet}`);
    }
  }
}

function run() {
  const cardRoot = path.join(process.cwd(), 'card');

  mustContain(path.join(cardRoot, 'index.html'), [
    'id="modal-toeic-practice"',
    'id="toeic-review-hub"',
    'initNewGame(mode =',
    'startToeicPractice()',
    'finishToeicSession()',
    'openToeicReview()'
  ]);

  mustContain(path.join(cardRoot, 'logic.js'), ['const Storage']);
  mustContain(path.join(cardRoot, 'data.js'), ['const CARDS']);
  mustContain(path.join(cardRoot, 'toeic.js'), ['const TOEIC_DATA']);

  console.log('Card smoke verification passed.');
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
