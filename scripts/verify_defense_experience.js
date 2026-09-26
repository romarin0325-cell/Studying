// Active release checks; the legacy battle engine retains its unit/integration suite.
require('./defense_browser_suite.cjs').runSuite('experience').catch(error=>{console.error(error);process.exitCode=1;});
