"""Local workbench. Uploaded sources are analyzed in memory and never executed."""
from __future__ import annotations
import argparse
import atexit
from collections import deque
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
import os
from pathlib import Path
import queue
import subprocess
import sys
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
import uuid
from .analysis import ROOT, analyze_files, go_binary, import_graph
from .demo import build_demo


class Runtime:
    def __init__(self, data_dir):
        self.children=[];self.startup=[];self.error=None;self.runs=deque(maxlen=40)
        data_dir.mkdir(parents=True,exist_ok=True)
        try:
            exe=go_binary('member-api',ROOT/'demo/api/main.go')
            storage=self.launch([sys.executable,str(ROOT/'demo/storage/service.py'),'--db',str(data_dir/'demo.sqlite')])
            self.storage=f"http://127.0.0.1:{storage['port']}"
            gateway=self.launch([exe,'--storage',self.storage])
            self.gateway=f"http://127.0.0.1:{gateway['port']}"
        except Exception as exc:
            self.error=str(exc);self.close()

    def launch(self, cmd):
        process=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,cwd=ROOT)
        self.children.append(process)
        q=queue.Queue()
        threading.Thread(target=lambda:q.put(process.stdout.readline()),daemon=True).start()
        try: line=q.get(timeout=20)
        except queue.Empty: raise RuntimeError('示例进程启动超时')
        if not line: raise RuntimeError('示例启动失败：'+process.stderr.read(1000))
        ready=json.loads(line)
        for e in ready.get('startup',[]): e['pid']=process.pid
        self.startup.extend(ready.get('startup',[]))
        return ready

    def close(self):
        for p in self.children:
            if p.poll() is None:
                p.terminate()
                try:p.wait(timeout=3)
                except subprocess.TimeoutExpired:p.kill();p.wait()
        for p in self.children:
            if p.stdout:p.stdout.close()
            if p.stderr:p.stderr.close()
        self.children=[]

    def execute(self, method='GET', body=None, scenario='normal', key=''):
        if self.error:raise RuntimeError(self.error)
        if method not in ('GET','POST') or scenario not in ('normal','fail_once'):
            raise ValueError('仅支持示例 GET/POST /members 与已声明场景')
        if not isinstance(body,(dict,type(None))) or not isinstance(key,str) or len(key)>128:
            raise ValueError('无效请求体或幂等键')
        trace=uuid.uuid4().hex
        started=time.perf_counter(); timestamp=datetime.now(timezone.utc).isoformat()
        headers={'Content-Type':'application/json','X-Trace-ID':trace}
        if scenario=='fail_once':headers['X-Demo-Fail']='once'
        if key:headers['Idempotency-Key']=key
        req=Request(self.gateway+'/members',data=json.dumps(body or {}).encode() if method=='POST' else None,headers=headers,method=method)
        try:
            with urlopen(req,timeout=5) as response:status=response.status;result=json.load(response)
        except HTTPError as exc:status=exc.code;result=json.load(exc)
        except (URLError,TimeoutError) as exc:raise RuntimeError('示例 API 暂不可用') from exc
        run=dict(id=trace,revision=getattr(self,'revision','unbound'),model='explicit-boundary-events',kind='request',method=method,path='/members',scenario=scenario,evidence='observed',timestamp=timestamp,duration_ms=round((time.perf_counter()-started)*1000,2),status=status,request=body,events=result.pop('events',[]),response=result)
        self.runs.appendleft(run)
        return run

    def rows(self):
        if self.error:raise RuntimeError(self.error)
        with urlopen(self.storage+'/state',timeout=3) as response:return json.load(response)


def main():
    parser=argparse.ArgumentParser(description='Software Observatory v0.1')
    parser.add_argument('--port',type=int,default=8765)
    parser.add_argument('--host',default='127.0.0.1')
    parser.add_argument('--no-runtime',action='store_true')
    parser.add_argument('--data-dir',type=Path,default=ROOT/'.atlas/session')
    args=parser.parse_args()
    print('Preparing trusted demo and source index…',flush=True)
    runtime=Runtime(args.data_dir) if not args.no_runtime else None
    if runtime:atexit.register(runtime.close)
    graph=build_demo()
    graph['capabilities']['runtime']=bool(runtime and not runtime.error)
    graph['capabilities']['rows']=graph['capabilities']['runtime']
    if runtime and runtime.error:graph['diagnostics'].insert(0,runtime.error)
    if runtime:runtime.revision=graph['revision']
    startup=dict(id='startup',kind='startup',evidence='observed',events=runtime.startup if runtime else [],notice='显式采集的启动里程碑；不是每条语句的自动追踪。')

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):pass
        def reply(self,status,data,content_type='application/json; charset=utf-8'):
            raw=json.dumps(data,ensure_ascii=False).encode() if content_type.startswith('application/json') else data
            self.send_response(status)
            self.send_header('Content-Type',content_type)
            self.send_header('Content-Length',str(len(raw)))
            self.send_header('Cache-Control','no-store')
            self.send_header('X-Content-Type-Options','nosniff')
            self.send_header('Referrer-Policy','no-referrer')
            self.end_headers()
            try:self.wfile.write(raw)
            except (BrokenPipeError,ConnectionResetError):pass
        def same_origin(self):
            origin=self.headers.get('Origin')
            return not origin or urlparse(origin).netloc==self.headers.get('Host')
        def read_json(self):
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=6_000_000:raise ValueError('请求为空或大于 6 MB')
            return json.loads(self.rfile.read(size))
        def proxy(self,method):
            if not runtime:raise RuntimeError('运行模式未启用')
            body=self.read_json() if method=='POST' else None
            run=runtime.execute(method,body,key=self.headers.get('Idempotency-Key',''))
            self.reply(run['status'],{**run['response'],'run':run})
        def do_GET(self):
            path=urlparse(self.path).path
            try:
                if path=='/api/graph':return self.reply(200,graph)
                if path=='/api/startup':return self.reply(200,startup)
                if path=='/api/runs':return self.reply(200,list(runtime.runs) if runtime else [])
                if path=='/api/rows':
                    if not runtime:raise RuntimeError('未启用示例数据库')
                    return self.reply(200,runtime.rows())
                if path=='/demo-api/members':return self.proxy('GET')
                static={'/':ROOT/'web/index.html','/app.js':ROOT/'web/app.js','/style.css':ROOT/'web/style.css','/demo/index.html':ROOT/'demo/web/index.html','/demo/portal.js':ROOT/'demo/web/portal.js'}
                if path in static:
                    mime=mimetypes.guess_type(str(static[path]))[0] or 'text/plain'
                    if path.endswith('.js'):mime='text/javascript'
                    return self.reply(200,static[path].read_bytes(),mime+'; charset=utf-8')
                return self.reply(404,{'error':'Not found'})
            except (RuntimeError,OSError,ValueError) as exc:self.reply(503,{'error':str(exc)})
        def do_POST(self):
            if not self.same_origin():return self.reply(403,{'error':'跨来源写请求被拒绝'})
            path=urlparse(self.path).path
            try:
                if path=='/demo-api/members':return self.proxy('POST')
                data=self.read_json()
                if path=='/api/analyze':return self.reply(200,analyze_files(data.get('files')))
                if path=='/api/import':return self.reply(200,import_graph(data))
                if path=='/api/execute':
                    if not runtime:raise RuntimeError('未启用真实运行模式')
                    return self.reply(200,runtime.execute(data.get('method','GET'),data.get('body'),data.get('scenario','normal'),data.get('key','')))
                return self.reply(404,{'error':'Not found'})
            except (ValueError,TypeError,AttributeError) as exc:self.reply(400,{'error':str(exc)})
            except (RuntimeError,OSError) as exc:self.reply(503,{'error':str(exc)})
    server=ThreadingHTTPServer((args.host,args.port),Handler)
    print(f'ATLAS_READY http://{args.host}:{server.server_port}',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:
        server.server_close()
        if runtime:runtime.close()
