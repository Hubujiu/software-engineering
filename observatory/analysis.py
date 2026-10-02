"""Bounded compiler-backed adapters and Graphify JSON import; no target execution."""
from __future__ import annotations
import ast
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
EXTENSIONS = {'.py', '.go', '.js', '.jsx', '.ts', '.tsx', '.sql', '.css'}


def safe_path(path):
    path = str(path).replace('\\', '/')
    if not path or path.startswith('/') or ':' in path or '..' in PurePosixPath(path).parts or '\x00' in path:
        raise ValueError('只接受项目内相对路径')
    return path


def go_binary(name, source):
    """Build only the tool's fixed trusted Go helpers; never a path from the request."""
    if not shutil.which('go'):
        raise RuntimeError('缺少 Go；Go 文件仅显示文件级结构')
    cache = ROOT / '.atlas' / 'bin'
    cache.mkdir(parents=True, exist_ok=True)
    exe = cache / (name + ('.exe' if os.name == 'nt' else ''))
    if not exe.exists() or exe.stat().st_mtime < source.stat().st_mtime:
        result = subprocess.run(['go', 'build', '-o', str(exe), str(source)], env={**os.environ, 'GO111MODULE': 'off', 'GOTOOLCHAIN': 'local', 'GOPROXY': 'off'}, capture_output=True, text=True, timeout=120)
        if result.returncode:
            raise RuntimeError(result.stderr[:500])
    return str(exe)


def python_extract(files):
    symbols, imports, diagnostics, edges = [], {}, [], []
    for path, source in files.items():
        try:
            tree = ast.parse(source)
        except (SyntaxError, ValueError, RecursionError) as exc:
            diagnostics.append(f'{path}: {exc}')
            continue
        records = []
        def collect(body, parent=''):
            for node in body:
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    name = f'{parent}.{node.name}' if parent else node.name
                    record = dict(name=name, file=path, kind='type' if isinstance(node, ast.ClassDef) else 'function', line=node.lineno, end=node.end_lineno, doc=ast.get_docstring(node) or '', calls=[], inputs=[a.arg for a in node.args.args] if hasattr(node, 'args') else [])
                    symbols.append(record); records.append((node, record))
                    collect(node.body, name)
        collect(tree.body)
        lookup = {r['name']: r for _, r in records}
        imports[path] = sorted({n.names[0].name if isinstance(n, ast.Import) else n.module or '' for n in ast.walk(tree) if isinstance(n, (ast.Import, ast.ImportFrom))})
        for node, record in records:
            if record['kind'] != 'function':
                continue
            shadowed = set(record['inputs'])
            scope = record['name'].rsplit('.', 1)[0] if '.' in record['name'] else ''
            for child in ast.walk(node):
                if isinstance(child, ast.Name) and isinstance(child.ctx, ast.Store): shadowed.add(child.id)
            def calls(n):
                if n is not node and isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Lambda)):
                    return
                if isinstance(n, ast.Call):
                    try: label = ast.unparse(n.func)
                    except RecursionError: label = '<unresolved>'
                    record['calls'].append(label)
                    target = None
                    if isinstance(n.func, ast.Name) and n.func.id not in shadowed:
                        target = lookup.get(f'{scope}.{label}') or lookup.get(label)
                    if target:
                        edges.append(dict(source=f"{path}::{record['name']}", target=f"{path}::{target['name']}", relation='calls', evidence='extracted'))
                    elif isinstance(n.func, ast.Attribute):
                        diagnostics.append(f'{path}:{n.lineno} {label}：动态/成员目标未绑定')
                for c in ast.iter_child_nodes(n): calls(c)
            calls(node)
    return dict(symbols=symbols, imports=imports, edges=edges, diagnostics=diagnostics)


def analyze_files(files):
    if not isinstance(files, dict) or len(files) > 150:
        raise ValueError('一次最多分析 150 个文本文件')
    normalized = {}
    for path, content in files.items():
        path = safe_path(path)
        if not isinstance(content, str) or len(content.encode()) > 512_000:
            raise ValueError('每个文件必须是小于 500 KB 的文本')
        if Path(path).suffix in EXTENSIONS:
            normalized[path] = content
    if sum(len(c.encode()) for c in normalized.values()) > 5_000_000:
        raise ValueError('项目文本总量不能超过 5 MB')
    nodes, edges, diagnostics, constants = [], [], [], {}
    for path, content in normalized.items():
        lang = {'.py':'Python','.go':'Go','.ts':'TypeScript','.tsx':'TypeScript','.js':'JavaScript','.jsx':'JavaScript','.sql':'SQL','.css':'CSS'}[Path(path).suffix]
        nodes.append(dict(id='file:'+path,label=Path(path).name,kind='file',language=lang,parent=None,summary=path,evidence='extracted',source={'path':path,'line':1,'end':len(content.splitlines())}))
    adapters = [('Python', {p:c for p,c in normalized.items() if p.endswith('.py')}), ('Go', {p:c for p,c in normalized.items() if p.endswith('.go')}), ('JS/TS', {p:c for p,c in normalized.items() if Path(p).suffix in {'.js','.jsx','.ts','.tsx'}})]
    for language, selected in adapters:
        if not selected: continue
        try:
            if language == 'Python': out = python_extract(selected)
            else:
                cmd = [go_binary('go-parser',ROOT/'tools/analyze-go.go')] if language == 'Go' else ['node',str(ROOT/'tools/analyze-js.cjs')]
                result = subprocess.run(cmd,input=json.dumps(selected),capture_output=True,text=True,timeout=30)
                if result.returncode: raise RuntimeError(result.stderr[:300])
                out = json.loads(result.stdout)
            diagnostics.extend(out.get('diagnostics', []))
            constants.update(out.get('constants', {}))
            for s in out['symbols']:
                path,name = s['file'],s['name']
                nodes.append(dict(id=path+'::'+name,label=name,kind=s['kind'],language=language,parent='file:'+path,summary=s.get('doc') or '源码已解析；未发现文档注释。',evidence='extracted',source=dict(path=path,line=s['line'],end=s['end']),calls=s.get('calls') or [],inputs=s.get('inputs') or []))
            for e in out.get('edges', []): edges.append(dict(source=e.get('source',e.get('from')),target=e.get('target',e.get('to')),relation=e.get('relation','calls'),evidence='extracted'))
            if language == 'Go':
                by_path = {(s['file'],s['name']):s for s in out['symbols']}
                for s in out['symbols']:
                    for call in s.get('calls') or []:
                        if (s['file'],call) in by_path and '.' not in call:
                            edges.append(dict(source=s['file']+'::'+s['name'],target=s['file']+'::'+call,relation='calls',evidence='inferred'))
            for path,deps in out.get('imports',{}).items():
                for dep in deps:
                    lib='lib:'+language+':'+dep
                    if not any(n['id']==lib for n in nodes): nodes.append(dict(id=lib,label=dep,kind='library',language=language,parent=None,summary='已解析导入；未索引库内部实现。',evidence='extracted'))
                    edges.append(dict(source='file:'+path,target=lib,relation='imports',evidence='extracted'))
        except (OSError, RuntimeError, subprocess.TimeoutExpired, ValueError) as exc:
            diagnostics.append(f'{language} 适配器不可用：{exc}')
    digest=hashlib.sha256(json.dumps(normalized,sort_keys=True).encode()).hexdigest()[:12]
    return dict(version=1,name='导入的源码项目',mode='analyzed',revision=digest,nodes=nodes,edges=edges,sources=normalized,diagnostics=diagnostics[:120],constants=constants,policies=[],capabilities={'runtime':False,'rows':False},notice='编译器/AST 结构快照；不是运行记录。成员和动态调用可能未解析，分层未自动推断。')


def import_graph(data):
    if not isinstance(data, dict) or not isinstance(data.get('nodes'), list):
        raise ValueError('需要包含 nodes 和 edges/links 的图谱 JSON')
    if len(data['nodes']) > 3000:
        raise ValueError('此原型最多导入 3000 个节点')
    nodes, edges, ids = [], [], set()
    for original in data['nodes']:
        if not isinstance(original, dict) or 'id' not in original: raise ValueError('节点缺少 id')
        id = str(original['id'])
        if id in ids or len(id)>512: raise ValueError('节点 id 重复或过长')
        ids.add(id)
        n=dict(id=id,label=str(original.get('label',original.get('name',id)))[:300],kind=str(original.get('kind','function')),parent=str(original['parent']) if original.get('parent') is not None else None,language=str(original.get('language','—')),summary=str(original.get('summary','外部图谱节点；请查看来源与置信标记。'))[:2000],evidence='imported')
        source=original.get('source_file')
        if source:
            safe_path(source)
            loc=re.search(r'\d+',str(original.get('source_location','1')))
            n['source']=dict(path=source,line=int(loc.group()) if loc else 1)
        nodes.append(n)
    for n in nodes:
        if n['parent'] not in ids: n['parent']=None
    rawedges=data.get('edges',data.get('links',[]))
    if not isinstance(rawedges,list) or len(rawedges)>12000: raise ValueError('边数量超过限制')
    for e in rawedges:
        a,b=str(e.get('source')),str(e.get('target'))
        if a not in ids or b not in ids: raise ValueError('边引用不存在的节点')
        evidence={'EXTRACTED':'extracted','INFERRED':'inferred','AMBIGUOUS':'unresolved'}.get(e.get('confidence'),'imported')
        edges.append(dict(source=a,target=b,relation=str(e.get('relation','related')),evidence=evidence))
    # Reject parent cycles instead of sending recursive structures to the UI.
    parents={n['id']:str(n['parent']) if n['parent'] is not None else None for n in nodes}
    for id in ids:
        seen=set();p=id
        while p is not None:
            if p in seen: raise ValueError('节点层级存在循环')
            seen.add(p);p=parents.get(p)
    return dict(version=1,name=str(data.get('name','Graphify 图谱'))[:150],mode='imported',revision='external',nodes=nodes,edges=edges,sources={},diagnostics=['导入的静态图不提供源码正文、运行记录或数据库行；不会混入示例数据。'],policies=[],capabilities={'runtime':False,'rows':False},notice='外部静态图谱；关系方向与置信标记保留，尚未运行。')
