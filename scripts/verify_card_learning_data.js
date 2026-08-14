const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function run() {
  const cardRoot = path.join(process.cwd(), 'card');
  const sandbox = { console };
  vm.createContext(sandbox);

  [
    'vocab_data.js',
    'collocation_data.js',
    'toeic_explanations.js',
    'toeic.js',
    'toeic_reserve_data.js'
  ].forEach((fileName) => {
    const filePath = path.join(cardRoot, fileName);
    vm.runInContext(fs.readFileSync(filePath, 'utf8'), sandbox, { filename: filePath });
  });

  const audit = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const expectedVocabWords = [
      'appreciate', 'finalize', 'extend', 'ongoing', 'alternative',
      'performance', 'staffing', 'funding', 'headquarters', 'investor',
      'analyze', 'insufficient', 'colleague', 'suggestion', 'guidance',
      'suspend', 'progress', 'record', 'eager', 'creative'
    ];
    const expectedCollocations = [
      [121, 'call it a day'],
      [122, 'break the ice'],
      [123, 'cut corners'],
      [124, 'get out of hand'],
      [125, 'hit the nail on the head'],
      [126, 'miss the boat'],
      [127, 'to make matters worse'],
      [128, 'go back to the drawing board'],
      [129, 'the ball is in your court'],
      [130, 'in hot water']
    ];
    const expectedToeic = [
      [70, 'part5', 3],
      [71, 'part5', 3],
      [72, 'part5', 3],
      [73, 'part6', 4],
      [74, 'part6', 4],
      [75, 'part6', 4],
      [76, 'part7', 4],
      [77, 'part7', 5],
      [78, 'part7', 5]
    ];

    const vocabByWord = new Map(VOCAB_SOURCE.map(item => [item.w, item]));
    const vocabEntriesByWord = new Map(VOCAB_DATA.map(item => [item.word, item]));
    const collocationsById = new Map(COLLOCATION_DATA.map(item => [item.id, item]));
    const toeicById = new Map(TOEIC_DATA.map(item => [item.id, item]));
    const reserveIds = new Set(TOEIC_RESERVE_DATA.map(item => item.id));
    const allToeicQuestions = [...TOEIC_DATA, ...TOEIC_RESERVE_DATA]
      .flatMap(set => set.questions.map(question =>
        ((set.passage || '') + '\\n' + question.question).trim().toLowerCase()
      ));
    const allToeicSets = [...TOEIC_DATA, ...TOEIC_RESERVE_DATA];
    const words = value => new Set(String(value || '')
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/[^a-z0-9$]+/g, ' ')
      .split(/\\s+/)
      .filter(word => word.length > 2));
    const jaccard = (leftValue, rightValue) => {
      const left = words(leftValue);
      const right = words(rightValue);
      const intersection = [...left].filter(word => right.has(word)).length;
      const union = new Set([...left, ...right]).size;
      return union ? intersection / union : 0;
    };
    const fixed = value => String(value || '').toLowerCase().replace(/\\s+/g, ' ').trim();
    const duplicateToeicPairs = [];
    for (let leftIndex = 0; leftIndex < allToeicSets.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < allToeicSets.length; rightIndex += 1) {
        const left = allToeicSets[leftIndex];
        const right = allToeicSets[rightIndex];
        if (left.type !== right.type || left.questions.length !== right.questions.length) continue;
        const answersEqual = left.questions.every((question, index) =>
          fixed(question.answer) === fixed(right.questions[index].answer)
        );
        const optionsEqual = left.questions.every((question, index) =>
          fixed(question.options.join('|')) === fixed(right.questions[index].options.join('|'))
        );
        const questionSimilarity = jaccard(
          left.questions.map(question => question.question).join(' '),
          right.questions.map(question => question.question).join(' ')
        );
        const passageSimilarity = jaccard(left.passage, right.passage);
        if (answersEqual && optionsEqual && questionSimilarity >= 0.6 && passageSimilarity >= 0.45) {
          duplicateToeicPairs.push([left.id, right.id]);
        }
      }
    }

    return {
      vocab: expectedVocabWords.map(word => {
        const source = vocabByWord.get(word);
        const direct = source && vocabEntriesByWord.get(source.w);
        const reciprocal = source && vocabEntriesByWord.get(source.tw);
        return {
          word,
          exists: Boolean(source),
          reciprocal: Boolean(
            direct && reciprocal &&
            direct.meaning === source.m &&
            direct.trap_meaning === source.tm &&
            direct.trap_word === source.tw &&
            reciprocal.meaning === source.tm &&
            reciprocal.trap_meaning === source.m &&
            reciprocal.trap_word === source.w
          )
        };
      }),
      collocations: expectedCollocations.map(([id, expression]) => {
        const item = collocationsById.get(id);
        return {
          id,
          expression,
          exists: item?.expression === expression,
          complete: Boolean(
            item && item.quizzes.length === 3 &&
            item.quizzes.every(quiz =>
              quiz.options.length === 4 &&
              new Set(quiz.options).size === quiz.options.length &&
              quiz.options.includes(quiz.answer) &&
              (quiz.question.match(/_______/g) || []).length === 1 &&
              typeof quiz.translation === 'string' && quiz.translation.length > 0
            )
          )
        };
      }),
      toeic: expectedToeic.map(([id, type, questionCount]) => {
        const set = toeicById.get(id);
        return {
          id,
          exists: Boolean(set),
          typeMatches: set?.type === type,
          questionCountMatches: set?.questions.length === questionCount,
          idsMatch: set?.questions.every((question, index) => question.id === id + '-' + (index + 1)) || false,
          answersValid: set?.questions.every(question => question.options.length === 4 && question.options.includes(question.answer)) || false,
          explanationExists: typeof TOEIC_EXPLANATIONS[id] === 'string' && TOEIC_EXPLANATIONS[id].length > 0,
          answersExplained: set?.questions.every(question => TOEIC_EXPLANATIONS[id].includes('정답: ' + question.answer)) || false,
          passageValid: type === 'part5'
            ? !set?.passage
            : typeof set?.passage === 'string' && set.passage.length > 0,
          blanksValid: type !== 'part6' || [1, 2, 3, 4].every(blank => set.passage.includes('(' + blank + ') _______')),
          reserveCollision: reserveIds.has(id)
        };
      }),
      uniqueVocabWords: new Set(VOCAB_DATA.map(item => item.word.toLowerCase())).size === VOCAB_DATA.length,
      uniqueCollocationIds: new Set(COLLOCATION_DATA.map(item => item.id)).size === COLLOCATION_DATA.length,
      uniqueCollocationExpressions: new Set(COLLOCATION_DATA.map(item => item.expression.trim().toLowerCase())).size === COLLOCATION_DATA.length,
      uniqueToeicIds: new Set(TOEIC_DATA.map(item => item.id)).size === TOEIC_DATA.length,
      uniqueToeicQuestionText: new Set(allToeicQuestions).size === allToeicQuestions.length,
      duplicateToeicPairs,
      allToeicQuestionIdsMatch: allToeicSets.every(set =>
        set.questions.every((question, index) => question.id === set.id + '-' + (index + 1))
      ),
      shiftedToeicExplanationsMatch: allToeicSets.filter(set => set.id >= 58).every(set =>
        typeof TOEIC_EXPLANATIONS[set.id] === 'string' &&
        set.questions.every(question => TOEIC_EXPLANATIONS[set.id].includes('정답: ' + question.answer))
      ),
      explanationKeysMatch: JSON.stringify(Object.keys(TOEIC_EXPLANATIONS).map(Number).sort((left, right) => left - right)) ===
        JSON.stringify(allToeicSets.map(set => set.id).sort((left, right) => left - right)),
      sequentialGlobalToeicIds: allToeicSets.map(set => set.id).sort((left, right) => left - right)
        .every((id, index) => id === index + 1),
      shiftedExplanationReferencesMatch: allToeicSets.filter(set => set.id >= 58).every(set => {
        const explanation = TOEIC_EXPLANATIONS[set.id] || '';
        const references = [...explanation.matchAll(/(?:문제|Question)\\s+(\\d+)-\\d+/g)]
          .map(match => Number(match[1]));
        return references.length > 0 && references.every(id => id === set.id);
      }),
      activeToeicMaxId: Math.max(...TOEIC_DATA.map(item => item.id)),
      reserveToeicMaxId: Math.max(...TOEIC_RESERVE_DATA.map(item => item.id))
    };
  })())`, sandbox));

  assert(audit.vocab.every(item => item.exists && item.reciprocal), 'Reviewed vocabulary pairs are incomplete');
  assert(audit.collocations.every(item => item.exists && item.complete), 'Reviewed collocations are incomplete');
  assert(audit.toeic.every(set =>
    set.exists &&
    set.typeMatches &&
    set.questionCountMatches &&
    set.idsMatch &&
    set.answersValid &&
    set.explanationExists &&
    set.answersExplained &&
    set.passageValid &&
    set.blanksValid &&
    !set.reserveCollision
  ), 'Reviewed TOEIC sets are incomplete or mismatched');
  assert.strictEqual(audit.uniqueVocabWords, true);
  assert.strictEqual(audit.uniqueCollocationIds, true);
  assert.strictEqual(audit.uniqueCollocationExpressions, true);
  assert.strictEqual(audit.uniqueToeicIds, true);
  assert.strictEqual(audit.uniqueToeicQuestionText, true);
  assert.deepStrictEqual(audit.duplicateToeicPairs, []);
  assert.strictEqual(audit.allToeicQuestionIdsMatch, true);
  assert.strictEqual(audit.shiftedToeicExplanationsMatch, true);
  assert.strictEqual(audit.explanationKeysMatch, true);
  assert.strictEqual(audit.sequentialGlobalToeicIds, true);
  assert.strictEqual(audit.shiftedExplanationReferencesMatch, true);
  assert.strictEqual(audit.activeToeicMaxId, 78);
  assert.strictEqual(audit.reserveToeicMaxId, 69);

  console.log('Card learning data verification passed (20 vocab pairs, 10 collocations, 9 TOEIC sets / 35 questions).');
}

run();
