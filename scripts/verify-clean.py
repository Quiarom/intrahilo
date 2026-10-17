"""Clean, bounded acceptance run. Does not publish, install models or reuse the working DB."""
from pathlib import Path
import json,os,shutil,subprocess,tempfile,time,urllib.request
root=Path(__file__).resolve().parents[1]
scratch=Path(os.environ.get('TMPDIR',str(Path.home()/'.hermes/cache/scratch')))
scratch.mkdir(parents=True,exist_ok=True)
clean=Path(tempfile.mkdtemp(prefix='intrahilo-clean-',dir=scratch))
for item in root.iterdir():
    if item.name in {'.git','node_modules','dist','var','artifacts','.env'}:continue
    if item.is_dir():shutil.copytree(item,clean/item.name)
    else:shutil.copy2(item,clean/item.name)
env={**os.environ,'INTRAHILO_DB':str(clean/'var/clean.sqlite'),'PORT':'4371','POLL_INTERVAL_SECONDS':'0','GENERATION_ENABLED':'false'}
# Do not pass product provider credentials to a clean-install test.
for key in ['GITHUB_TOKEN','GENERATION_API_KEY','GENERATION_BASE_URL','GENERATION_MODEL','OLLAMA_URL','QDRANT_URL','EMBEDDING_MODEL','SOURCES_CONFIG','INTRAHILO_TAXONOMY']:env.pop(key,None)
commands=[['npm','ci','--no-audit','--no-fund'],['npm','run','demo:reset'],['npm','run','typecheck'],['npm','test'],['npm','run','build'],['npm','run','test:mcp']]
log=[]
for command in commands:
    result=subprocess.run(command,cwd=clean,env=env,text=True,capture_output=True,timeout=120)
    log.append({'command':' '.join(command),'exitCode':result.returncode,'output':result.stdout+result.stderr})
    if result.returncode:
        print(json.dumps({'result':'FAILED','workspace':str(clean),'commands':log},ensure_ascii=False,indent=2));raise SystemExit(1)
server=subprocess.Popen(['node','--import','tsx','src/server.ts'],cwd=clean,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
try:
    base='http://127.0.0.1:4371'
    for _ in range(60):
        try:
            with urllib.request.urlopen(base+'/api/radar',timeout=2) as r:radar=json.load(r)
            break
        except Exception:time.sleep(.1)
    else:raise RuntimeError('Clean server did not start')
    with urllib.request.urlopen(base,timeout=3) as r:assert 'INTRAHILO' in r.read().decode()
    with urllib.request.urlopen(base+'/api/topics/memory',timeout=3) as r:topic=json.load(r)
    assert radar['windows']['current']['total']==25
    assert topic['topic']['currentCount']==5 and topic['evidence'] and topic['externalUpdates']
    for e in topic['evidence']:
        with urllib.request.urlopen(base+'/api/evidence/'+e['id'],timeout=3) as r:exact=json.load(r)
        assert exact['text']==e['text']
    req=urllib.request.Request(base+'/api/demo/replay',method='POST')
    with urllib.request.urlopen(req,timeout=3) as r:replay=json.load(r)
    assert replay['inserted']==3
    with urllib.request.urlopen(base+'/api/radar',timeout=3) as r:after=json.load(r)
    assert after['windows']['current']['total']==28
    result={'result':'CLEAN_INSTALL_OK','workspace':str(clean),'commands':log,'http':{'radarTotal':25,'memoryCount':5,'evidenceLinksChecked':len(topic['evidence']),'replayInserted':replay['inserted'],'afterReplayTotal':28},'limits':'No network sources, vector services or generation used in this clean verification.'}
    (root/'artifacts').mkdir(exist_ok=True)
    (root/'artifacts/clean-install.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps({k:v for k,v in result.items() if k!='commands'},ensure_ascii=False,indent=2))
finally:
    server.terminate()
    try:server.wait(timeout=5)
    except subprocess.TimeoutExpired:server.kill();server.wait()
