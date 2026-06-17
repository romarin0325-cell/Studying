# Title
card: update Gemini model IDs, refine date intervals, and optimize mode select UI

## Summary
- **Gemini Model Update**: Replaced deprecated `gemini-3-flash-preview` with `gemini-3.1-flash-lite` in the API primary model ID and UI load triggers.
- **Date System Logic Adjustment**:
  - Refactored `getDateContent` in `api.js` to change the loneliness/disappointment response threshold from 3 days to 7 days (`daysSinceLastDate >= 7`).
  - Added an affection/flirtation boost for dates within 3 days (`daysSinceLastDate <= 3`) without mentioning exact days/durations.
  - Left the 3-to-7-day range clear of any special prompt injections.
- **Mode Select Modal UI Optimization**:
  - Reduced individual button padding (`10px` -> `8px`) and font size (`0.9rem` -> `0.8rem`) in `#mode-list`.
  - Shrunk grid gap (`5px` -> `4px`) and reduced `<h3>` margin top/bottom.
  - Increased the description box (`#mode-desc`) height from `100px` to `130px` to prevent overflow and visibility issues on mobile with 11+ modes.

## Testing
- Ran validation tests with `npm run verify` (smoke tests and lint checks passed successfully).

## Notes
- None
