const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('card/toeic.js', 'utf8');
const sandbox = {};
vm.createContext(sandbox);

try {
    vm.runInContext(code, sandbox);
    // Try to access TOEIC_DATA by evaluating it in the context
    const data = vm.runInContext('TOEIC_DATA', sandbox);

    if (Array.isArray(data)) {
        console.log("TOEIC_DATA loaded successfully. Length:", data.length);
    } else {
        console.error("TOEIC_DATA is not an array");
        process.exit(1);
    }
} catch (e) {
    console.error("Error in card/toeic.js:", e);
    process.exit(1);
}
