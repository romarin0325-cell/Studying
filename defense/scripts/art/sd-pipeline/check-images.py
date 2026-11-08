"""Run the frozen, independently sourced checker on ONE actual workflow atlas.

No image generation, remote API, diffusion runtime or aesthetic auto-approval.
"""
import sys, os, json, hashlib, importlib.util, importlib.metadata
from pathlib import Path
sys.dont_write_bytecode = True
environment_loader=importlib.util.spec_from_file_location('audit_environment',Path(__file__).with_name('audit-environment.py'))
environment_module=importlib.util.module_from_spec(environment_loader)
environment_loader.loader.exec_module(environment_module)
sys.dont_write_bytecode = True
os.environ.setdefault('HF_HUB_OFFLINE', '1')
os.environ.setdefault('HF_HUB_DISABLE_PROGRESS_BARS', '1')
atlas, destination, checker_path, reference_path = map(Path, sys.argv[1:5])
sha = lambda b: hashlib.sha256(b).hexdigest()
loader = importlib.util.spec_from_file_location('frozen_checker', checker_path)
checker = importlib.util.module_from_spec(loader)
loader.loader.exec_module(checker)
baseline = json.loads(reference_path.read_text(encoding='utf-8'))
cast = [r for r in baseline['files'] if r['group'] == 'installed']
row = checker.measure_geometry(atlas, 'workflow-output')
row['character'] = atlas.parent.name
row['sourceSha256'] = sha(atlas.read_bytes())
checker.attach_similarity(row)
checker.batch_ccip([row])
distribution = checker.score_records([row], cast)
report = {'python': sys.version,
          **environment_module.environment(),
          'checkerSource': str(checker_path), 'checkerSha256': sha(checker_path.read_bytes()),
          'referenceDistribution': {'file': str(reference_path), 'generatedAt': baseline['generated_at'], 'sha256': sha(reference_path.read_bytes()), 'count': len(cast)},
          'distribution': distribution, 'files': [checker.public_record(row)],
          'meaning': 'Detections and perceptual distances are warning signals, not anatomical skull ground truth.'}
destination.write_text(json.dumps(checker.clean(report), ensure_ascii=False, indent=2), encoding='utf-8')
print('Measured actual atlas: ' + str(atlas), flush=True)
