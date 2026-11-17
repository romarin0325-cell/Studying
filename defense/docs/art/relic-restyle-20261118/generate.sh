#!/bin/bash
# usage: run.sh <dir> <ref...> ; generates via codex, then copies the session's own image to <dir>/sheet.png
d=$1; shift; args=(); for r in "$@"; do args+=(-i "$r"); done
cd "$d" || exit 1   # <dir> holds prompt.md
codex exec --skip-git-repo-check -m gpt-6.1-terra -c model_reasoning_effort="low" -s read-only -C . "${args[@]}" -o last.txt - < prompt.md > log.txt 2>&1; echo "exit $?" >> log.txt
sid=$(grep -m1 -o "session id: [0-9a-f-]*" log.txt | cut -d' ' -f3); f=$(ls -t "$HOME/.codex/generated_images/$sid"/*.png 2>/dev/null | head -1)
[ -n "$f" ] && cp "$f" sheet.png && echo "copied $f" >> log.txt || echo "NO IMAGE for $sid" >> log.txt
