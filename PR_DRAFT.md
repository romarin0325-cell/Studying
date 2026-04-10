# Title
card: add reserve TOEIC/vocab data files for later migration

## Summary
- add non-loaded reserve TOEIC dataset entries 51-58 under `card/toeic_reserve_data.js`
- add non-loaded reserve vocab entries under `card/vocab_reserve_data.js`
- document intended future migration targets in file comments so the data can be moved into production files later

## Testing
- `npm run verify`

## Notes
- The new reserve files are intentionally not referenced by `card/index.html`, so current in-game content and behavior stay unchanged.
- Production hookup remains unverified because this patch intentionally avoids loading the reserve data into the game.
