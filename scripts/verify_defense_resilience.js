// Active release checks; the legacy battle engine retains its unit/integration suite.
require('./defense_browser_suite.cjs').runSuite('resilience').catch(error=>{console.error(error);process.exitCode=1;});
