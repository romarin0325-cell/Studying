"""One-time CPU audit environment; no game builds, paid APIs, or image generation."""
import argparse, json, os, subprocess, sys
from pathlib import Path
here=Path(__file__).resolve().parent
game=here.parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--warm-models',action='store_true',help='Download/cache open checker weights and run one real measurement.')
args=parser.parse_args()
if sys.version_info[:2] != (3,12): raise SystemExit('Use Python3.12, or point DEFENSE_ART_SETUP_PYTHON to a Python3.12 interpreter.')
runtime=game/'test-results/sd-pipeline/runtime'; runtime.mkdir(parents=True,exist_ok=True)
venv=runtime/'.venv'; python=venv/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
if not python.exists(): subprocess.run([sys.executable,'-m','venv',str(venv)],check=True)
subprocess.run([str(python),'-m','pip','install','--disable-pip-version-check','-r',str(here/'requirements.lock.txt')],check=True)
if args.warm_models:
    env={**os.environ,'HF_HUB_OFFLINE':'0','HF_HUB_DISABLE_PROGRESS_BARS':'1'}
    atlas=game/'docs/art/sol-cast-v2/structure-masters/style-siren.webp'
    subprocess.run([str(python),str(here/'check-images.py'),str(atlas),str(runtime/'warmup.json'),str(here/'checker.py'),str(game/'docs/art/sd-pipeline/reference-cast.json')],check=True,env=env)
print(json.dumps({'python':str(python),'modelsWarmed':args.warm_models,'gameModified':False}))
