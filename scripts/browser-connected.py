"""Optional real-browser smoke test. Requires Python Playwright, Chromium and local fixtures.
Run db:fixtures and dev:connected on port 3001 first. No hosted data is used.
"""
import base64
import hashlib
import hmac
import json
import os
import struct
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

fixtures = json.loads(Path('.local/test-accounts.json').read_text())
base = 'http://127.0.0.1:3001'
errors = []
checks = []

def sign_in(page, name):
    page.goto(base, wait_until='networkidle')
    expect(page.get_by_role('heading', name='Volunteer sign in')).to_be_visible()
    page.get_by_label('Email', exact=True).fill(fixtures['users'][name]['email'])
    page.get_by_label('Password', exact=True).fill(fixtures['users'][name]['password'])
    page.get_by_role('button', name='Sign in', exact=True).click()

def code(secret):
    key = base64.b32decode(secret + '=' * ((8 - len(secret) % 8) % 8))
    digest = hmac.new(key, struct.pack('>Q', int(time.time()) // 30), hashlib.sha1).digest()
    offset = digest[-1] & 15
    return str((struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7fffffff) % 1000000).zfill(6)

with sync_playwright() as p:
    options = {'headless': True}
    if os.getenv('CHROMIUM_PATH'):
        options['executable_path'] = os.environ['CHROMIUM_PATH']
    browser = p.chromium.launch(**options)
    context = browser.new_context(viewport={'width': 1280, 'height': 960})
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base, wait_until='networkidle')
    page.get_by_label('Email', exact=True).fill('nobody@shepherd.test')
    page.get_by_label('Password', exact=True).fill('WrongPassword123!')
    page.get_by_role('button', name='Sign in', exact=True).click()
    expect(page.get_by_role('alert')).to_contain_text('Sign-in failed')
    sign_in(page, 'owner')
    expect(page.get_by_role('heading', name='My people', exact=True)).to_be_visible()
    expect(page.get_by_text('Colleague Only Contact', exact=True)).to_have_count(0)
    page.get_by_role('link', name='Local Test Contact').click()
    note = 'Browser durable note ' + str(time.time_ns())
    page.get_by_label('Conversation note').fill(note)
    page.get_by_role('button', name='Save follow-up').click()
    expect(page.get_by_role('status')).to_have_text('Follow-up saved.')
    expect(page.get_by_text(note, exact=True)).to_be_visible()
    page.reload(wait_until='networkidle')
    expect(page.get_by_text(note, exact=True)).to_be_visible()
    checks.append('Sign-in errors, ownership filtering, save and refresh persistence')
    failed_note = 'Retained draft ' + str(time.time_ns())
    page.route('**/rest/v1/rpc/shepherd_record_follow_up', lambda route: route.abort())
    page.get_by_label('Conversation note').fill(failed_note)
    page.get_by_role('button', name='Save follow-up').click()
    expect(page.get_by_role('alert')).to_contain_text('save could not be confirmed')
    expect(page.get_by_label('Conversation note')).to_have_value(failed_note)
    page.unroute('**/rest/v1/rpc/shepherd_record_follow_up')
    page.get_by_role('button', name='Save follow-up').click()
    expect(page.get_by_role('status')).to_have_text('Follow-up saved.')
    expect(page.get_by_text(failed_note, exact=True)).to_have_count(1)
    checks.append('Failed saves retain the draft and retry saves one note')
    second = context.new_page()
    second.goto(base + '/people/' + fixtures['person'], wait_until='networkidle')
    expect(second.get_by_label('Conversation note')).to_be_visible()
    second.get_by_label('Conversation note').fill('A draft based on an old version')
    page.get_by_label('Outcome', exact=True).select_option('Do not contact')
    page.get_by_role('button', name='Save follow-up').click()
    expect(page.get_by_role('status')).to_have_text('Follow-up saved.')
    expect(page.get_by_role('link', name='Call', exact=True)).to_have_count(0)
    # Save before periodic refresh or after it: both must stop stale overwrite.
    stale_save = second.get_by_role('button', name='Save follow-up')
    if stale_save.is_enabled():
        stale_save.click()
    expect(second.get_by_role('alert').first).to_contain_text('contact', timeout=15000)
    expect(second.get_by_label('Conversation note')).to_have_value('A draft based on an old version')
    second.close()
    checks.append('Concurrent browser edits are rejected; Do not contact hides contact links')
    page.set_viewport_size({'width': 375, 'height': 812})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile overflow'
    page.get_by_role('button', name='Sign out').click()
    expect(page.get_by_role('heading', name='Volunteer sign in')).to_be_visible()
    expect(page.get_by_text(note, exact=True)).to_have_count(0)
    sign_in(page, 'colleague')
    expect(page.get_by_role('heading', name='My people', exact=True)).to_be_visible()
    page.goto(base + '/people/' + fixtures['person'], wait_until='networkidle')
    expect(page.get_by_role('alert')).to_contain_text('not assigned to you')
    page.goto(base + '/admin/people', wait_until='networkidle')
    expect(page.get_by_role('heading', name='Administrator access required')).to_be_visible()
    checks.append('Mobile layout, logout clears records, another user cannot open the contact')
    page.get_by_role('button', name='Sign out').click()
    sign_in(page, 'admin')
    expect(page.get_by_role('heading', name='Verify your account')).to_be_visible()
    factor = {}
    def capture(response):
        if '/auth/v1/factors' in response.url and response.request.method == 'POST' and response.ok:
            data = response.json()
            if data.get('totp'):
                factor.update(data)
    page.on('response', capture)
    page.get_by_role('button', name='Set up or verify authenticator').click()
    expect(page.get_by_alt_text('Authenticator setup QR code')).to_be_visible()
    page.get_by_label('Six-digit code').fill(code(factor['totp']['secret']))
    page.get_by_role('button', name='Verify', exact=True).click()
    expect(page.get_by_role('heading', name='Administrator dashboard', exact=True)).to_be_visible()
    page.goto(base + '/admin/people', wait_until='networkidle')
    expect(page.get_by_role('heading', name='People', exact=True)).to_be_visible()
    page.get_by_role('button', name='Add person', exact=True).click()
    page.get_by_label('Full name', exact=True).fill('Browser Created Person')
    page.get_by_label('Phone number (optional)').fill('+447700900456')
    page.get_by_label('Permanent owner').select_option(fixtures['users']['owner']['id'])
    page.locator('form').get_by_role('button', name='Add person', exact=True).click()
    expect(page.get_by_role('link', name='Browser Created Person')).to_be_visible()
    checks.append('Administrator authenticator setup and persistent person creation')
    browser.close()
assert not errors, errors
print(json.dumps({'passed_checks': checks, 'page_errors': errors}, indent=2))
