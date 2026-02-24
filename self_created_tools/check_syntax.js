
const fs = require('fs');
const html = fs.readFileSync('card/index.html', 'utf8');
const scriptContent = html.match(/<script defer>([\s\S]*?)<\/script>/)[1];
try {
    new Function(scriptContent);
    console.log("Syntax OK");
} catch (e) {
    console.error("Syntax Error:", e.message);
    process.exit(1);
}
