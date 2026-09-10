import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.dirname(__filename);

async function build() {
    console.log('✨ Building Celestial Azure Card RPG Single HTML Distribution...');

    const templatePath = path.join(root, 'src', 'template.html');
    const cssPath = path.join(root, 'src', 'ui', 'theme.css');

    let html = await fs.readFile(templatePath, 'utf8');
    const css = await fs.readFile(cssPath, 'utf8');

    // Replace stylesheet placeholder
    html = html.replace('<!-- STYLESHEET_PLACEHOLDER -->', `<style>\n${css}\n</style>`);

    // Script files in dependency order
    const scriptFiles = [
        path.join(root, 'src', 'ui', 'sfx.js'),
        path.join(root, 'src', 'core', 'data.js'),
        path.join(root, 'src', 'core', 'vocab_data.js'),
        path.join(root, 'src', 'core', 'collocation_data.js'),
        path.join(root, 'src', 'core', 'grammar_data.js'),
        path.join(root, 'src', 'core', 'toeic.js'),
        path.join(root, 'src', 'core', 'toeic_explanations.js'),
        path.join(root, 'src', 'core', 'listening_data.js'),
        path.join(root, 'src', 'core', 'api.js'),
        path.join(root, 'src', 'core', 'logic.js'),
        path.join(root, 'src', 'core', 'battle_runtime.js'),
        path.join(root, 'src', 'core', 'rpg_features.js'),
        path.join(root, 'src', 'core', 'fortune_cookie.js'),
        path.join(root, 'src', 'core', 'music_data.js'),
        path.join(root, 'src', 'core', 'music_player.js'),
        path.join(root, 'src', 'core', 'rpg_controller.js'),
        path.join(root, 'src', 'ui', 'app_view.js')
    ];

    let combinedScripts = 'window._scriptLoadErrors = [];\nwindow._scriptLoadComplete = true;\n\n';
    for (const sPath of scriptFiles) {
        const code = await fs.readFile(sPath, 'utf8');
        const fileName = path.basename(sPath);
        combinedScripts += `/* === MODULE: ${fileName} === */\n${code}\n\n`;
    }

    // Escape any </script> in embedded code
    const safeScripts = combinedScripts.replaceAll('</script', '<\\/script');
    if (html.includes('<!-- SCRIPTS_PLACEHOLDER -->')) {
        html = html.replace('<!-- SCRIPTS_PLACEHOLDER -->', `<script>\n${safeScripts}\n</script>`);
    } else if (html.includes('<!-- SCRIPT_PLACEHOLDER -->')) {
        html = html.replace('<!-- SCRIPT_PLACEHOLDER -->', `<script>\n${safeScripts}\n</script>`);
    } else {
        html = html.replace('</body>', `<script>\n${safeScripts}\n</script>\n</body>`);
    }

    const distDir = path.join(root, 'dist');
    await fs.mkdir(distDir, { recursive: true });

    const distPath = path.join(distDir, 'CardRPG.html');
    await fs.writeFile(distPath, html, 'utf8');

    const stat = await fs.stat(distPath);
    const sizeMb = (stat.size / 1024 / 1024).toFixed(2);
    console.log(`✅ Build Complete! Standalone Distribution: ${distPath} (${sizeMb} MB)`);
}

build().catch(err => {
    console.error('❌ Build failed:', err);
    process.exit(1);
});
