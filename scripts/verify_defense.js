// Active Confluence release. Legacy engine regressions remain in defense/tests.
import('./verify_defense_confluence.mjs').then(({verifyConfluence})=>verifyConfluence()).catch(error=>{console.error(error);process.exitCode=1;});
