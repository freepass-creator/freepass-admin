"""Resolve only reviewed conflicts between pinned core and Claude e-sign work."""
from pathlib import Path
import subprocess,re
ESIGN='77e5e1d8485e71e217e2026af0cd82ffa17fd5cb'
CORE='27e3c4385132f45715f388c82c115151e05bd634'
def source(ref,path):return subprocess.check_output(['git','show',ref+':'+path],text=True)
assert subprocess.check_output(['git','rev-parse','MERGE_HEAD'],text=True).strip()==ESIGN
paths=set(subprocess.check_output(['git','diff','--name-only','--diff-filter=U'],text=True).splitlines())
assert paths=={'package.json','src/services/esign/runtime.test.ts','src/services/esign/service.ts'}
p=Path('package.json');t=p.read_text();t=re.sub(r'^<<<<<<< HEAD\n(.*?)^=======\n(.*?)^>>>>>>> [^\n]+\n',lambda m:m.group(1).rstrip()+',\n'+m.group(2),t,flags=re.M|re.S);p.write_text(t)
p=Path('src/services/esign/service.ts');t=p.read_text();t=re.sub(r'^<<<<<<< HEAD\n(.*?)^=======\n(.*?)^>>>>>>> [^\n]+\n',"const POST_SUBMISSION = new Set<string>(['pending_review', 'approving', 'signed']);\n",t,flags=re.M|re.S);p.write_text(t)
p=Path('src/services/esign/runtime.test.ts');t=p.read_text();prefix=t.split('<<<<<<< HEAD\n')[0];a=source(CORE,str(p));b=source(ESIGN,str(p));a=a[a.index("test('admin journey:"):];b=b[b.index("test('esign finalization rejects truncated PDF bytes"):];p.write_text(prefix+'\n'+a+'\n'+b)
for path in paths: assert not re.search(r'^(<<<<<<<|=======|>>>>>>>)',Path(path).read_text(),re.M),path
subprocess.run(['git','add','package.json','src'],check=True)
