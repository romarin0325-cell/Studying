const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "defense_hero");

function collect(directory, extension, result = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(absolute, extension, result);
    else if (entry.name.endsWith(extension)) result.push(absolute);
  }
  return result;
}

const scripts = collect(path.join(root, "js"), ".js");
if (scripts.length < 10) throw new Error("Hero Defense runtime files are missing");

for (const file of scripts) {
  const source = fs.readFileSync(file, "utf8");
  if (/\bMath\.random\s*\(/.test(source)) {
    throw new Error(`Direct Math.random call is forbidden: ${path.relative(root, file)}`);
  }
  const checked = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (checked.status !== 0) {
    process.stderr.write(checked.stderr || checked.stdout);
    process.exit(checked.status || 1);
  }
}

const required = ["index.html", "README.md", "css/app.css", "js/main.js", "js/data/content.js"];
for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) throw new Error(`Missing required Hero Defense file: ${relative}`);
}

console.log(`Hero Defense static verification OK (${scripts.length} runtime modules)`);
