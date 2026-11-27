# PM practice questions — rewrite one batch of self-made questions to IPA 午前Ⅱ quality

You are rewriting one batch of the self-made PM practice questions (source "개념 확인") in `defense/src/course.js`.
The outcome is fixed and all decisions below are made: do not ask questions, make reasonable reversible choices and note them in the report. Work until the batch passes the checker. Only stop early on a usage-limit error.

## Why
The player is preparing for the IPA プロジェクトマネージャ試験 in Japan. The game teaches in Korean (lectures, term notes, explanations) and should test in exam Japanese.
The 197 self-made questions were translated to Japanese but keep their old structure, and they can be answered without knowing PM:
- in 147 of 197 the correct choice is more than 1.2× longer than every wrong choice (86% are simply the longest);
- answer positions are ① 39% / ② 48% / ③ 11% / ④ 1.5%;
- many wrong choices are absurd (改ざん, 無視して強行, 何年間でも, 手書きの帳票), so they are never plausible;
- many use 「」 and 、 while IPA booklets use “ ” and ，.
Example of the problem (T100-q2): the answer is a 90-character sentence; the three distractors are 15-20 characters and unrelated (予備費の配分, WBSの見直し, 利益率の高い製品).

What a good question looks like (in the style of real IPA 午前Ⅱ):
```
WBSを作成する主な目的はどれか。
① 作業間の依存関係を明確にし，実施順序を決定する。
② プロジェクトの作業範囲を管理可能な単位に階層的に分解する。
③ 各作業の担当者を決定し，責任と権限を明確にする。
④ 各作業に必要な資源を見積もり，実施時期を決定する。
```
Every choice is a real PM activity of the same grammatical shape and similar length; only knowing what WBS is (vs. スケジュール作成, RAM/責任分担マトリックス, 資源見積り) gives the answer.

## Decisions (fixed)
1. Keep each question's `id` and keep testing the same concept the current question tests (same lecture/term). Read the lecture (`body`, `principles`, `confusion`, `point`) or term (`explain`, `hint`) in `defense/src/course.js` for that concept; the question must agree with that Korean teaching text. If you think the teaching text itself is wrong, still write a question that is correct by PMBOK 6th/7th edition, JIS Q 21500 / ISO 21502, or the IPA syllabus, and report the conflict.
2. `prompt` and all four `choices` are 100% Japanese in IPA exam style: “…として，適切なものはどれか。” / “…はどれか。”, full-width ，and 。, quotes “ ”, never 「」 or 、. Use IPA spellings (ステークホルダ, プロジェクトマネージャ, メンバ, コンピュータ, サーバ). No Korean anywhere in prompt or choices.
3. Distractors are real, related PM concepts or practices that are wrong for this question — the things candidates actually confuse (予測型 vs 適応型, CPI vs SPI, 回避/転嫁/軽減/受容, スコープ記述書 vs WBS辞書, クラッシング vs ファストトラッキング, 定性的分析 vs 定量的分析, 検証 vs 妥当性確認, etc.). Each distractor would be a correct statement about some *other* concept, or a common misconception. Never absurd, unethical or lazy wrong choices (falsifying data, ignoring problems, unlimited time, handwriting), and never a distractor that is obviously silly to a non-specialist.
4. The four choices share the same form (all nouns, or all sentences with the same ending) and similar specificity and length. Hard limits checked by the script: the longest choice ≤ 1.8× the shortest (when any choice is over 12 characters), and the correct choice ≤ 1.2× the longest wrong choice. Aim for the correct choice to be the longest only about a quarter of the time. Do not put hedge words (適切に, 総合的に, バランスよく) only in the answer, and do not put absolutes (必ず, すべて, 一切, のみ, だけ) only in the distractors.
5. The correct answer goes at the index given for that id in `defense/docs/review/pm-quiz-20261128/plan.json` (`target`, 0=① … 3=④). The plan balances positions across all 197 questions; do not deviate.
6. `explain` is Korean in 해요체 (…예요/…이에요/…해요), 2–4 sentences. Name the correct choice with its circled number (①②③④ — the game shows these, never ア〜エ) and say in one clause for each wrong choice which concept it actually describes or why it is wrong. Keep Japanese technical terms in Japanese (e.g. スコープ記述書(스코프 기술서)) as the existing explanations do.
7. Calculation questions stay calculation questions; give the numbers so the answer is unique, make distractors the results of typical mistakes, and show the working in `explain`.
8. The `source` stays "개념 확인" (you do not write it; the merge keeps it).

## Must not change
- Do not edit `defense/src/course.js` or any other file in the repository except your own output file and report below. Claude merges the batches.
- Do not rewrite IPA original questions (any source other than "개념 확인"); they are not in your batch.
- No git write commands (commit, reset, checkout, clean, push, stash), no builds, no browser or desktop control tools, nothing outside this worktree.

## Your batch
Your batch name and ids are in `plan.json` under `batches` (the batch name is given at the end of this brief). Rewrite exactly those ids.

## Output
Append one JSON object per line to `defense/docs/review/pm-quiz-20261128/batches/<batch>.jsonl` as you finish each question (write as you go, so work survives an interruption):
`{"id":"T001-q2","prompt":"…","choices":["…","…","…","…"],"answer":1,"explain":"…"}`
If you redo a question, replace its line (one line per id in the final file).

## Verify
Run `node defense/scripts/pm-quiz-check.mjs defense/docs/review/pm-quiz-20261128/batches/<batch>.jsonl` until it prints `OK` (it checks Korean leakage, punctuation, absurd wording, length balance, target index, and that the explanation names the answer). The script cannot check facts: before finishing, re-read every question once as an examinee and confirm exactly one choice is correct and each distractor is clearly wrong for a knowledgeable candidate.

## Report (Korean, concise) — write it as your final message
처리한 문항 수 · 검사 결과(OK 출력) · 강의/용어 본문과 충돌하거나 사실이 의심되는 곳(문항 id와 이유) · 판단이 애매했던 문항과 내린 선택 · 못 한 것.
