"""Version fingerprint shared by measurement and cache verification; no local paths."""
import hashlib, importlib.metadata, json, platform, sys
def environment():
    packages={k:importlib.metadata.version(k) for k in ['dghs-imgutils','onnxruntime','numpy','scikit-image','pillow']}
    full={'python':platform.python_version(),'platform':sys.platform,'packages':sorted((d.metadata['Name'].lower(),d.version) for d in importlib.metadata.distributions())}
    return {'packages':packages,'environment':full,'environmentFingerprint':hashlib.sha256(json.dumps(full,sort_keys=True).encode()).hexdigest()}
if __name__=='__main__': print(json.dumps(environment()))
