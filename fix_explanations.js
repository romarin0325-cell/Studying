const fs = require('fs');

const explRaw = fs.readFileSync('card/toeic_explanations.js', 'utf8');
const explModuleStr = explRaw.replace(/const TOEIC_EXPLANATIONS = /, 'module.exports = ');
fs.writeFileSync('temp_expl.js', explModuleStr);
const explanations = require('./temp_expl.js');

// Print all keys
console.log("Current explanation keys:", Object.keys(explanations).map(Number).sort((a,b)=>a-b));
