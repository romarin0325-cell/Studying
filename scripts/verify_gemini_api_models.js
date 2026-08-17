const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FLASH_MODEL_ID = 'gemini-3.7-flash';
const FLASH_LITE_MODEL_ID = 'gemini-3.5-flash-lite';
const LEGACY_MODEL_IDS = ['gemini-3-flash-preview', 'gemini-3.1-flash-lite'];

function countMatches(source, pattern) {
  return (source.match(pattern) || []).length;
}

function assertOfficialRequestShape(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  LEGACY_MODEL_IDS.forEach(modelId => {
    assert.strictEqual(source.includes(modelId), false, `${filePath} still references ${modelId}`);
  });
  assert.strictEqual(source.includes('?key='), false, `${filePath} still sends the API key in the URL`);

  const fetchLines = source.split(/\r?\n/).filter(line => line.includes('fetch('));
  assert(fetchLines.length > 0, `${filePath} has no Gemini request to verify`);
  fetchLines.forEach(line => {
    assert(
      line.includes('fetch(getGeminiGenerateContentUrl('),
      `${filePath} has a request that bypasses the shared generateContent URL helper`
    );
  });
  assert.strictEqual(
    countMatches(source, /headers:\s*getGeminiRequestHeaders\(/g),
    fetchLines.length,
    `${filePath} must use the official API-key header on every request`
  );
}

function makeGeminiResponse() {
  return {
    ok: true,
    status: 200,
    text: async () => '',
    json: async () => ({
      candidates: [{
        content: {
          role: 'model',
          parts: [{ text: 'ok' }]
        }
      }]
    })
  };
}

async function run() {
  const root = process.cwd();
  const cardApiPath = path.join(root, 'card', 'api.js');
  const remasterApiPath = path.join(root, 'card_remaster', 'api.js');
  const relatedFiles = [
    cardApiPath,
    path.join(root, 'card', 'index.html'),
    path.join(root, 'card', 'fortune_cookie.js'),
    remasterApiPath
  ];

  relatedFiles.forEach(filePath => {
    const source = fs.readFileSync(filePath, 'utf8');
    LEGACY_MODEL_IDS.forEach(modelId => {
      assert.strictEqual(source.includes(modelId), false, `${filePath} still references ${modelId}`);
    });
  });
  assertOfficialRequestShape(cardApiPath);
  assertOfficialRequestShape(remasterApiPath);
  const remasterApiSource = fs.readFileSync(remasterApiPath, 'utf8');
  assert(
    remasterApiSource.includes(`const GEMINI_FLASH_MODEL_ID = '${FLASH_MODEL_ID}';`),
    'card_remaster/api.js must target the current Flash model'
  );
  assert.strictEqual(
    remasterApiSource.includes('temperature'),
    false,
    'card_remaster/api.js must not send removed sampling parameters to Gemini 3.x'
  );

  const requests = [];
  const sandbox = {
    console,
    AbortController,
    DOMException,
    setTimeout,
    clearTimeout,
    fetch: async (url, options) => {
      requests.push({
        url: String(url),
        headers: { ...(options.headers || {}) },
        body: JSON.parse(options.body)
      });
      return makeGeminiResponse();
    },
    RPG: {
      global: { tutoringEventEnabled: false },
      state: { enemyScale: 0 }
    },
    GAME_CONSTANTS: {
      TUTORING_EVENT: {
        STAGE_THRESHOLD: 30,
        PROB_HIGH: 0.5,
        PROB_BASE: 0.3
      }
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(cardApiPath, 'utf8'), sandbox, { filename: cardApiPath });

  const evaluate = source => vm.runInContext(source, sandbox, { filename: 'gemini-api-regression' });
  const modelOptions = JSON.parse(evaluate(
    'JSON.stringify(LumiQuestionRuntime.MODEL_OPTIONS.map(option => option.id))'
  ));
  assert.deepStrictEqual(modelOptions, ['gemini-2.5-pro', FLASH_MODEL_ID, FLASH_LITE_MODEL_ID]);

  for (const modelId of [FLASH_MODEL_ID, FLASH_LITE_MODEL_ID]) {
    await evaluate(`GameAPI.getTutoringContent(
      'test-key',
      { word: 'sample', meaning: '표본' },
      'word',
      { model: '${modelId}' }
    )`);
    await evaluate(`requestLumiQuestion(
      'test-key',
      [{ role: 'user', parts: [{ text: 'hello' }] }],
      { model: '${modelId}', enableSearch: false, timeoutMs: 0 }
    )`);
    await evaluate(`GameAPI.getDateContent(
      'test-key',
      {
        theme: '도서관',
        outfit: '교복',
        weather: '실내',
        keyword: '귀여운 실수',
        word: 'study',
        secret: false,
        daysSinceLastDate: 4
      },
      { model: '${modelId}' }
    )`);
    await evaluate(`GameAPI.getFortuneContent(
      'test-key',
      {
        grade: '대길',
        gradeDescription: '좋은 하루',
        keyword: '반짝이는 영감',
        timeOfDay: 'morning',
        event: null
      },
      { model: '${modelId}' }
    )`);
  }

  assert.strictEqual(requests.length, 8);
  requests.forEach((request, index) => {
    const expectedModel = index < 4 ? FLASH_MODEL_ID : FLASH_LITE_MODEL_ID;
    assert(
      request.url.endsWith(`/v1beta/models/${expectedModel}:generateContent`),
      `request ${index + 1} used the wrong model URL: ${request.url}`
    );
    assert.strictEqual(request.url.includes('?'), false);
    assert.strictEqual(request.headers['Content-Type'], 'application/json');
    assert.strictEqual(request.headers['x-goog-api-key'], 'test-key');
    assert.strictEqual(
      Object.hasOwn(request.body.generationConfig || {}, 'temperature'),
      false,
      `request ${index + 1} sent a deprecated sampling parameter`
    );
  });

  console.log('Gemini API model verification passed.');
}

run().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
