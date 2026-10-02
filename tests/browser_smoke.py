"""Browser acceptance. Default: live app. --snapshot: recorded UI only, no E2E claim."""
import argparse
import json
from pathlib import Path
import uuid
from playwright.sync_api import sync_playwright, expect

parser=argparse.ArgumentParser()
parser.add_argument('--base',default='http://127.0.0.1:8765')
parser.add_argument('--snapshot',type=Path)
parser.add_argument('--chromium')
parser.add_argument('--screenshots',type=Path)
args=parser.parse_args()
with sync_playwright() as p:
    options={'headless':True}
    if args.chromium:options['executable_path']=args.chromium
    browser=p.chromium.launch(**options)
    page=browser.new_page(viewport={'width':1512,'height':1024})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    if args.snapshot:page.set_content(args.snapshot.read_text(encoding='utf-8'))
    else:page.goto(args.base)
    expect(page.locator('.graph-node')).to_have_count(4)
    if args.screenshots:
        args.screenshots.mkdir(parents=True,exist_ok=True)
        page.screenshot(path=str(args.screenshots/'architecture.png'))
    page.locator('.graph-node[data-id="api"]').dblclick()
    expect(page.locator('.graph-node h3').filter(has_text='连接 / Client 层')).to_have_count(1)
    page.locator('[data-action="view"][data-value="requests"]').click()
    page.select_option('#req-scenario','fail_once')
    page.locator('[data-action="send"]').click()
    expect(page.locator('.trace-step')).to_have_count(7)
    page.locator('.trace-step').nth(5).click()
    expect(page.locator('.inspector')).to_contain_text('row_count')
    page.locator('[data-action="event-rows"]').click()
    expect(page.locator('.data-table tbody tr')).to_have_count(4)
    page.locator('[data-action="view"][data-value="startup"]').click()
    expect(page.locator('.step-row')).to_have_count(6)
    page.locator('[data-action="startup-play"]').click()
    expect(page.locator('.trace-step.active')).to_have_count(1,timeout=4000)
    page.locator('[data-action="trace-play"]').click()
    page.locator('[data-action="view"][data-value="policies"]').click()
    expect(page.locator('.policy-card')).to_have_count(5)
    page.locator('.policy-card').first.click()
    page.locator('[data-action="inspect-source"]').click()
    expect(page.locator('.inspector .source')).to_contain_text('clientTimeout')
    page.locator('[data-action="search"]').click()
    page.locator('#search-input').fill('list_members')
    expect(page.locator('.search-result')).to_have_count(1)
    page.keyboard.press('Escape')
    if not args.snapshot:
        page.locator('[data-action="view"][data-value="frontend"]').click()
        frame=page.frame_locator('#live-preview')
        expect(frame.locator('.member')).to_have_count(4)
        frame.locator('.member').first.click()
        expect(page.locator('.inspector')).to_contain_text('flex')
        # A selection and subsequent run must not reload the iframe.
        frame.locator('[name="name"]').fill('Browser test')
        frame.locator('[name="email"]').fill(uuid.uuid4().hex+'@example.test')
        frame.locator('form button').click()
        expect(frame.locator('.member')).to_have_count(5)
        expect(page.locator('.trace-step')).to_have_count(5)
        page.locator('[data-action="import"]').click()
        page.locator('#graph-input').set_input_files({'name':'graph.json','mimeType':'application/json','buffer':json.dumps({'nodes':[{'id':'x','label':'Imported source'}],'edges':[]}).encode()})
        expect(page.locator('.graph-node')).to_have_count(1)
        page.locator('[data-action="view"][data-value="requests"]').click()
        expect(page.locator('.empty-state')).to_contain_text('静态项目')
        expect(page.locator('.trace-dock')).to_have_count(0)
    page.set_viewport_size({'width':720,'height':900})
    page.locator('[data-action="view"][data-value="architecture"]').click()
    if args.screenshots:page.screenshot(path=str(args.screenshots/'compact.png'))
    assert not errors,errors
    browser.close()
print('PASS: snapshot interaction suite' if args.snapshot else 'PASS: live end-to-end suite')
