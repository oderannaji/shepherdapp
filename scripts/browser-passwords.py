"""Real local Auth callbacks, password updates and recovery MFA. Never uses a hosted project."""
import base64
import hashlib
import hmac
import json
import os
import struct
import time
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

f = json.loads(Path('.local/password-links.json').read_text())
assert all(urlparse(f[name]['url']).hostname == '127.0.0.1' for name in ['invite', 'recovery', 'adminRecovery'])
base = 'http://127.0.0.1:3001/'
errors = []
checks = []

def code(secret):
    secret += '=' * ((8 - len(secret) % 8) % 8)
    digest = hmac.new(base64.b32decode(secret), struct.pack('>Q', int(time.time()) // 30), hashlib.sha1).digest()
    offset = digest[-1] & 15
    return str((struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7fffffff) % 1000000).zfill(6)

def fill_password(page):
    page.get_by_label('New password', exact=True).fill(f['newPassword'])
    page.get_by_label('Confirm password', exact=True).fill(f['newPassword'])
    page.get_by_role('button', name='Save password', exact=True).click()
    expect(page.get_by_role('heading', name='Your password is saved')).to_be_visible()
    page.get_by_role('button', name='Continue to Shepherd').click()

with sync_playwright() as p:
    options = {'headless': True}
    if os.getenv('CHROMIUM_PATH'):
        options['executable_path'] = os.environ['CHROMIUM_PATH']
    browser = p.chromium.launch(**options)
    invite_context = browser.new_context()
    page = invite_context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(f['invite']['url'], wait_until='networkidle')
    expect(page.get_by_role('heading', name='Create your password')).to_be_visible()
    assert 'access_token' not in page.url and 'refresh_token' not in page.url
    page.reload(wait_until='networkidle')
    expect(page.get_by_role('heading', name='Create your password')).to_be_visible()
    page.get_by_label('New password', exact=True).fill(f['newPassword'])
    page.get_by_label('Confirm password', exact=True).fill('Mismatching long password')
    page.get_by_role('button', name='Save password', exact=True).click()
    expect(page.get_by_role('alert')).to_contain_text('do not match')
    fill_password(page)
    expect(page.get_by_role('heading', name='My people', exact=True)).to_be_visible()
    page.get_by_role('button', name='Sign out').click()
    expect(page.get_by_role('heading', name='Welcome back')).to_be_visible()
    page.get_by_label('Email', exact=True).fill(f['invite']['email'])
    page.get_by_label('Password', exact=True).fill(f['newPassword'])
    page.get_by_role('button', name='Sign in', exact=True).click()
    expect(page.get_by_role('heading', name='My people', exact=True)).to_be_visible()
    checks.append('An invitation creates a password, survives refresh and allows a later password login')
    page.goto(base + '?test=expired#error=access_denied&error_code=otp_expired&type=recovery', wait_until='networkidle')
    expect(page.get_by_role('heading', name='This sign-in link could not be verified')).to_be_visible()
    expect(page.get_by_label('New password', exact=True)).to_have_count(0)
    page.get_by_role('button', name='Back to sign in').click()
    expect(page.get_by_role('heading', name='Welcome back')).to_be_visible()
    checks.append('An expired callback cannot turn an existing account session into password recovery')
    invite_context.close()

    recovery_context = browser.new_context()
    page = recovery_context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(f['recovery']['url'], wait_until='networkidle')
    expect(page.get_by_role('heading', name='Choose a new password')).to_be_visible()
    fill_password(page)
    expect(page.get_by_role('heading', name='My people', exact=True)).to_be_visible()
    page.get_by_role('button', name='Sign out').click()
    expect(page.get_by_role('heading', name='Welcome back')).to_be_visible()
    page.get_by_label('Email', exact=True).fill(f['recovery']['email'])
    page.get_by_label('Password', exact=True).fill(f['newPassword'])
    page.get_by_role('button', name='Sign in', exact=True).click()
    expect(page.get_by_role('heading', name='My people', exact=True)).to_be_visible()
    checks.append('Recovery changes the password and the new password works after logout')
    page.get_by_role('button', name='Sign out').click()
    expect(page.get_by_role('heading', name='Welcome back')).to_be_visible()
    page.get_by_role('button', name='Forgot password?').click()
    page.get_by_label('Email', exact=True).fill(f['invite']['email'])
    page.get_by_role('button', name='Send reset link').click()
    expect(page.get_by_role('status')).to_contain_text('If this email belongs to an account')
    checks.append('Password-reset requests use a non-enumerating confirmation message')
    recovery_context.close()

    admin_context = browser.new_context()
    page = admin_context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(f['adminRecovery']['url'], wait_until='networkidle')
    expect(page.get_by_role('heading', name='Verify your account')).to_be_visible()
    expect(page.get_by_label('New password', exact=True)).to_have_count(0)
    page.get_by_role('button', name='Set up or verify authenticator').click()
    page.get_by_label('Six-digit code').fill(code(f['adminRecovery']['secret']))
    page.get_by_role('button', name='Verify', exact=True).click()
    expect(page.get_by_role('heading', name='Choose a new password')).to_be_visible()
    fill_password(page)
    expect(page.get_by_role('heading', name='People', exact=True)).to_be_visible()
    checks.append('An administrator with an enrolled authenticator must verify MFA before changing a password')
    admin_context.close()
    browser.close()
assert not errors, errors
print(json.dumps({'passed_checks': checks, 'page_errors': errors}, indent=2))
