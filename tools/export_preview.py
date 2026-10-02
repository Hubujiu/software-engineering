"""Export a network-independent UI containing explicitly labelled recorded demo runs."""
import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]


def export_preview(base, output):
    def get(path, body=None):
        req = Request(base + path, data=json.dumps(body).encode() if body else None, headers={'Content-Type': 'application/json'})
        with urlopen(req, timeout=15) as r:
            return json.load(r)
    # GET-only experiments do not alter domain rows.
    snapshot = dict(graph=get('/api/graph'), startup=get('/api/startup'), dataset=get('/api/rows'), runs=[get('/api/execute', {'method':'GET', 'scenario':scenario}) for scenario in ('normal', 'fail_once')])
    serialized = json.dumps(snapshot, ensure_ascii=False).replace('<', '\\u003c')
    css = (ROOT/'web/style.css').read_text()
    js = (ROOT/'web/app.js').read_text().replace('</script', '<\\/script')
    html = f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Atlas · 可交互预览</title><style>{css}</style></head><body><div id="app"></div><div id="toast" role="status"></div><script>window.__ATLAS_SNAPSHOT__={serialized};</script><script>{js}</script></body></html>'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding='utf-8')
    return snapshot


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', default='http://127.0.0.1:8765')
    parser.add_argument('--out', type=Path, default=ROOT/'dist/atlas-preview.html')
    args = parser.parse_args()
    export_preview(args.base.rstrip('/'), args.out)
    print(args.out)
