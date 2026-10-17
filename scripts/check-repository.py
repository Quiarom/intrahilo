"""Small baseline scanner, not a substitute for GitHub secret scanning."""
from pathlib import PurePosixPath
import re
import subprocess
import sys

PATTERNS = [
    rb'(?m)^-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s*$',
    rb'gh[pousr]_[A-Za-z0-9]{30,}',
    rb'github_pat_[A-Za-z0-9_]{40,}',
    rb'sk-(?:proj-)?[A-Za-z0-9_-]{32,}',
    rb'AKIA[0-9A-Z]{16}',
]

def findings(path, content):
    p = PurePosixPath(path)
    unsafe = p.name == '.env' or (p.name.startswith('.env.') and not p.name.endswith('.example'))
    unsafe |= bool(set(p.parts) & {'node_modules', 'var', '__pycache__', '.hermes'})
    unsafe |= p.suffix in {'.sqlite', '.sqlite3', '.db', '.pem', '.key', '.pyc'}
    return unsafe or any(re.search(pattern, content) for pattern in PATTERNS)

def self_test():
    assert findings('.env', b'')
    assert findings('.env.local', b'')
    assert findings('var/state.sqlite', b'')
    assert findings('src/key.ts', b'ghp_' + b'A' * 36)
    assert findings('src/key.ts', b'-----BEGIN PRIVATE KEY-----')
    assert not findings('.env.example', b'API_KEY=\n')
    assert not findings('src/config.ts', b'const token = process.env.API_KEY;')

if __name__ == '__main__':
    self_test()
    if '--self-test' in sys.argv:
        print('Repository scanner self-tests passed')
        sys.exit(0)
    # Scan reachable history as well as the tracked working tree; report paths, never secret values.
    objects = subprocess.check_output(['git', 'rev-list', '--objects', '--all']).splitlines()
    bad = set()
    for line in objects:
        parts = line.split(b' ', 1)
        if len(parts) != 2:
            continue
        oid, raw_path = parts
        if subprocess.check_output(['git', 'cat-file', '-t', oid]).strip() != b'blob':
            continue
        path = raw_path.decode('utf-8', errors='replace')
        content = subprocess.check_output(['git', 'cat-file', 'blob', oid])
        if findings(path, content):
            bad.add(path)
    for raw_path in subprocess.check_output(['git', 'ls-files', '-z']).split(b'\0'):
        if raw_path:
            from pathlib import Path
            path = raw_path.decode()
            if findings(path, Path(path).read_bytes()):
                bad.add(path)
    if bad:
        print('Review flagged tracked/history paths:\n' + '\n'.join(sorted(bad)))
        sys.exit(1)
    print('Repository baseline check passed (patterns only; not proof of no secrets)')
