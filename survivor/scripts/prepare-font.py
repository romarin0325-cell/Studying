"""Optional authoring tool. Builds the committed font cache; release builds use it directly."""
from pathlib import Path
import hashlib
import json
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[2]
source = root / "card/assets/Jua-Regular.ttf"
text = "".join(p.read_text() for p in (root / "survivor/src").glob("*.*"))
text += "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+−% /·—→♡♢☾☽☀✦✧❀❄❁◷ϟ➶✵◇Ⅱ×abcdefghijklmnopqrstuvwxyz가나다라마바사아자차카타파하"
font = TTFont(source)
options = subset.Options()
options.flavor = "woff"
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=text)
subsetter.subset(font)
font.flavor = "woff"
for record in font["name"].names:
    if record.nameID in (1, 4, 6):
        name = "JuaNocturneSubset" if record.nameID == 6 else "Jua Nocturne Subset"
        record.string = name.encode(record.getEncoding())
font.recalcTimestamp = False
font.save(root / "survivor/assets/Jua-Nocturne.woff")
font_bytes = (root / "survivor/assets/Jua-Nocturne.woff").read_bytes()
manifest = {
    "name": "Jua Nocturne Subset",
    "source": "card/assets/Jua-Regular.ttf",
    "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    "file": "Jua-Nocturne.woff",
    "sha256": hashlib.sha256(font_bytes).hexdigest(),
    "processorSha256": hashlib.sha256(Path(__file__).read_bytes().replace(b"\r\n", b"\n")).hexdigest(),
    "codePoints": sorted(font.getBestCmap()),
    "license": "SIL Open Font License 1.1; Jua-OFL.txt is embedded in the release HTML",
}
(root / "survivor/assets/font-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print("Prepared Jua Nocturne subset (SIL OFL 1.1)")
