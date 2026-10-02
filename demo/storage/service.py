"""Bundled demo domain service. Only this trusted fixture is executed by Atlas."""
from __future__ import annotations
import argparse
from contextlib import contextmanager
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import sqlite3
import threading
import time
import uuid

SOURCE = 'demo/storage/service.py'


def event(label, symbol, kind, started, trace, *, state=None, rows=None, sql=None):
    return dict(id=uuid.uuid4().hex[:12], label=label, symbol=symbol, kind=kind,
                service='storage', evidence='observed', trace_id=trace,
                started_at=datetime.now(timezone.utc).isoformat(),
                duration_ms=round((time.perf_counter() - started) * 1000, 3),
                state=state or {}, rows=rows, sql=sql, source=SOURCE)


@dataclass
class Member:
    """One result model; team is projected from a joined teams row, not members."""
    id: str
    name: str
    email: str
    team_id: str
    team: str
    created_at: str


class MemberStore:
    """SQLite-backed fixture with explicit transactions and idempotency records."""
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        with self.connect() as db:
            db.executescript((Path(__file__).with_name('schema.sql')).read_text())
            db.executemany('INSERT OR IGNORE INTO teams VALUES (?, ?)', [('t-product', '产品研发'), ('t-design', '设计体验')])
            seed = [('m-001', '林一', 'lin.yi@example.test', 't-product'), ('m-002', '陈序', 'chen.xu@example.test', 't-design'), ('m-003', '许知远', 'xu.zy@example.test', 't-product'), ('m-004', '周可', 'zhou.ke@example.test', 't-design')]
            for row in seed:
                db.execute('INSERT OR IGNORE INTO members (id,name,email,team_id,created_at) VALUES (?,?,?,?,?)', (*row, '2026-10-01T09:00:00+00:00'))

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=1.5)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys = ON')
        try:
            with db:
                yield db
        finally:
            db.close()

    def list_members(self, trace: str):
        """Read joined rows and retain their actual values in this run's snapshot."""
        started = time.perf_counter()
        sql = 'SELECT m.id,m.name,m.email,m.team_id,t.name AS team,m.created_at FROM members m JOIN teams t ON t.id=m.team_id ORDER BY m.created_at,m.id'
        with self.connect() as db:
            data = [asdict(Member(**dict(row))) for row in db.execute(sql).fetchall()]
        return {'data': data, 'events': [event('读取成员与部门', 'MemberStore.list_members', 'query', started, trace, rows=data, sql=sql, state={'row_count': len(data), 'snapshot': 'captured result', 'mapping': {'name': 'members.name', 'email': 'members.email', 'team': 'teams.name'}})]}

    def create_member(self, payload: dict, key: str, trace: str):
        """Validate, deduplicate and commit the member plus operation key together."""
        started = time.perf_counter()
        name = str(payload.get('name', '')).strip()
        email = str(payload.get('email', '')).strip().lower()
        team = str(payload.get('team_id', 't-product'))
        if not name or len(name) > 64 or len(email) > 180 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
            raise ValueError('请输入姓名和有效邮箱（姓名最多 64 字，邮箱最多 180 字）')
        if len(key) > 128:
            raise ValueError('幂等键超过 128 字符')
        normalized = json.dumps([name, email, team], ensure_ascii=False)
        fingerprint = hashlib.sha256(normalized.encode()).hexdigest()
        events = [event('校验成员资料', 'MemberStore.create_member', 'function', started, trace, state={'name': name, 'email': email, 'team_id': team})]
        with self.lock, self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if key:
                prior = db.execute('SELECT fingerprint,member_id FROM operations WHERE key=?', (key,)).fetchone()
                if prior:
                    if prior['fingerprint'] != fingerprint:
                        raise ValueError('同一幂等键不能用于不同的成员资料')
                    row = dict(db.execute('SELECT * FROM members WHERE id=?', (prior['member_id'],)).fetchone())
                    events.append(event('返回已提交结果 · 不重复写入', 'MemberStore.create_member', 'policy', started, trace, rows=[row], state={'replayed': True, 'idempotency_key': key}))
                    return {'data': row, 'events': events, 'replayed': True}
            member_id = str(uuid.uuid4())
            created = datetime.now(timezone.utc).isoformat()
            try:
                db.execute('INSERT INTO members VALUES (?,?,?,?,?)', (member_id, name, email, team, created))
                if key:
                    db.execute('INSERT INTO operations VALUES (?,?,?)', (key, fingerprint, member_id))
                db.commit()
            except sqlite3.IntegrityError as exc:
                raise ValueError('邮箱已存在，或指定的部门不存在') from exc
        row = dict(id=member_id, name=name, email=email, team_id=team, created_at=created)
        events.append(event('提交成员记录', 'MemberStore.create_member', 'query', started, trace, rows=[row], sql='INSERT INTO members VALUES (?,?,?,?,?)', state={'transaction': 'committed', 'generator': 'uuid.uuid4', 'member_id': member_id}))
        return {'data': row, 'events': events, 'replayed': False}

    def snapshot(self):
        with self.connect() as db:
            return {table: {'columns': [dict(x) for x in db.execute(f'PRAGMA table_info({table})')], 'rows': [dict(x) for x in db.execute(f'SELECT * FROM {table} ORDER BY rowid')]} for table in ('members', 'teams')}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--db', required=True)
    parser.add_argument('--port', type=int, default=0)
    args = parser.parse_args()
    started = time.perf_counter()
    store = MemberStore(Path(args.db))
    startup = [event('读取存储配置', 'main', 'startup', started, 'startup-storage', state={'database': Path(args.db).name, 'binding': '127.0.0.1'}), event('初始化表、约束和种子数据', 'MemberStore.__init__', 'startup', started, 'startup-storage', state={'foreign_keys': True, 'busy_timeout_ms': 1500})]

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def reply(self, status, data):
            body = json.dumps(data, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            trace = self.headers.get('X-Trace-ID', 'standalone')
            if self.path == '/state':
                return self.reply(200, store.snapshot())
            if self.path != '/members':
                return self.reply(404, {'error': 'Not found'})
            if self.headers.get('X-Demo-Fail') == 'once' and self.headers.get('X-Attempt') == '1':
                return self.reply(503, {'error': '受控实验：首次读取失败', 'events': [event('注入一次 503', 'main', 'fault', time.perf_counter(), trace, state={'scenario': 'fail_once'})]})
            self.reply(200, store.list_members(trace))

        def do_POST(self):
            if self.path != '/members':
                return self.reply(404, {'error': 'Not found'})
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 4096:
                    raise ValueError('请求体需在 1–4096 字节之间')
                data = json.loads(self.rfile.read(length))
                if not isinstance(data, dict):
                    raise ValueError('请求体必须为 JSON 对象')
                result = store.create_member(data, self.headers.get('Idempotency-Key', ''), self.headers.get('X-Trace-ID', 'standalone'))
                self.reply(200 if result['replayed'] else 201, result)
            except (ValueError, TypeError) as exc:
                self.reply(400, {'error': str(exc), 'events': []})

    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    startup.append(event('存储服务开始监听', 'main', 'startup', started, 'startup-storage', state={'port': server.server_port, 'ready': True}))
    print(json.dumps({'port': server.server_port, 'startup': startup}), flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
