"""Connected administration and volunteer journeys against local synthetic data only."""
import base64, hashlib, hmac, json, os, struct, time
from pathlib import Path
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from playwright.sync_api import sync_playwright, expect
f=json.loads(Path('.local/test-accounts.json').read_text())
base='http://127.0.0.1:3001'
checks=[]; errors=[]
def code(secret):
 key=base64.b32decode(secret+'='*((8-len(secret)%8)%8));d=hmac.new(key,struct.pack('>Q',int(time.time())//30),hashlib.sha1).digest();o=d[-1]&15
 return str((struct.unpack('>I',d[o:o+4])[0]&0x7fffffff)%1000000).zfill(6)
def login(page,who):
 page.goto(base+('/admin/overview' if who=='admin' else '/'),wait_until='networkidle')
 expect(page.get_by_role('heading',name='Administrator sign in' if who=='admin' else 'Volunteer sign in')).to_be_visible()
 page.get_by_label('Email',exact=True).fill(f['users'][who]['email']);page.get_by_label('Password',exact=True).fill(f['users'][who]['password']);page.get_by_role('button',name='Sign in',exact=True).click()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'))
 ac=browser.new_context(viewport={'width':1280,'height':960});a=ac.new_page();a.on('pageerror',lambda e:errors.append(str(e)))
 login(a,'admin');expect(a.get_by_role('heading',name='Verify your account')).to_be_visible();factor={}
 def capture(response):
  if '/auth/v1/factors' in response.url and response.request.method=='POST' and response.ok:
   data=response.json()
   if data.get('totp'):factor.update(data)
 a.on('response',capture);a.get_by_role('button',name='Set up or verify authenticator').click();expect(a.get_by_alt_text('Authenticator setup QR code')).to_be_visible();a.get_by_label('Six-digit code').fill(code(factor['totp']['secret']));a.get_by_role('button',name='Verify',exact=True).click();expect(a.get_by_role('heading',name='Administrator dashboard')).to_be_visible()
 a.get_by_label('Service date',exact=True).fill(str(datetime.now(ZoneInfo('Europe/London')).date()-timedelta(days=1)));a.get_by_role('button',name='Create service',exact=True).click();expect(a.get_by_role('status')).to_have_text('Saved.')
 checks.append('Separate administrator entry, real MFA and service creation')
 vc=browser.new_context(viewport={'width':375,'height':812});v=vc.new_page();v.on('pageerror',lambda e:errors.append(str(e)));login(v,'owner');expect(v.get_by_role('heading',name='My people',exact=True)).to_be_visible();expect(v.get_by_role('combobox',name='Demo role')).to_have_count(0);expect(v.get_by_role('link',name='Administration',exact=True)).to_have_count(0)
 v.goto(base+'/admin/users',wait_until='networkidle');expect(v.get_by_role('heading',name='Administrator access required')).to_be_visible();v.get_by_role('link',name='Return to my dashboard').click();v.get_by_role('link',name='Expected',exact=True).click()
 expect(v.get_by_role('heading',name='Create your Expected list')).to_be_visible();v.get_by_label('Local Test Contact',exact=True).check();v.get_by_role('button',name='Review list',exact=True).click();v.get_by_role('button',name='Publish list',exact=True).click();expect(v.get_by_role('heading',name='Your published list')).to_be_visible();v.reload(wait_until='networkidle');expect(v.get_by_label('Local Test Contact',exact=True)).to_be_checked();v.get_by_label('Attendance for Local Test Contact').select_option('came');v.get_by_role('button',name='Review list',exact=True).click();v.get_by_role('button',name='Post results and lock list').click();expect(v.get_by_text('Results are posted and locked. Ask an administrator to correct them.')).to_be_visible();assert v.evaluate('document.documentElement.scrollWidth <= innerWidth')
 checks.append('Volunteer cannot enter admin; Expected publish, reload and locked results work on mobile')
 a.goto(base+'/admin/sunday',wait_until='networkidle');card=a.locator('article').filter(has=a.get_by_text('Local Test Contact',exact=True));card.get_by_role('combobox').select_option('absent');a.get_by_label('Reason / source').fill('Welcome desk register');a.get_by_role('button',name='Confirm attendance changes').click();expect(card.get_by_text('Conflicting reports')).to_be_visible()
 a.goto(base+'/admin/reconciliation',wait_until='networkidle');card=a.locator('article').filter(has=a.get_by_text('Local Test Contact',exact=True));card.get_by_role('combobox').select_option('absent');a.get_by_label('Reason / source').fill('Checked with caller');a.get_by_role('button',name='Confirm attendance changes').click();expect(a.get_by_text('No conflicts to resolve.')).to_be_visible();v.goto(base+'/recovery',wait_until='networkidle');expect(v.get_by_role('link',name='Local Test Contact')).to_be_visible()
 checks.append('Attendance conflicts require reconciliation; confirmed absences appear in Recovery')
 a.goto(base+'/admin/import',wait_until='networkidle');a.get_by_label('Assign imported people to').select_option(f['users']['owner']['id']);a.get_by_label('CSV content').fill('name,phone\n"Imported, Browser",+447700900987');a.get_by_role('button',name='Validate and preview').click();expect(a.get_by_role('heading',name='Review 1 people')).to_be_visible();a.get_by_role('button',name='Confirm import').click();expect(a.get_by_role('status')).to_have_text('Saved.');a.goto(base+'/admin/people',wait_until='networkidle');expect(a.get_by_role('link',name='Imported, Browser')).to_be_visible()
 a.goto(base+'/admin/assignments',wait_until='networkidle');a.get_by_label('Person',exact=True).select_option(f['person']);a.get_by_label('Permanent owner',exact=True).select_option(f['users']['colleague']['id']);a.get_by_label('Reason',exact=True).fill('Assign to another caller');a.get_by_role('button',name='Save changes',exact=True).click();expect(a.get_by_role('status')).to_have_text('Saved.');v.goto(base+'/people/'+f['person'],wait_until='networkidle');expect(v.get_by_role('alert')).to_contain_text('not assigned to you')
 checks.append('Reviewed CSV import persists; changing ownership removes old volunteer access')
 a.goto(base+'/admin/users',wait_until='networkidle');expect(a.get_by_role('heading',name='Accounts and access')).to_be_visible();member=a.locator('article').filter(has=a.get_by_text(f['users']['owner']['email'],exact=True));member.get_by_label('Access',exact=True).select_option('false');member.get_by_label('Reason for access change').fill('End volunteer access');member.get_by_role('button',name='Save access').click();expect(member.get_by_role('status')).to_have_text('Saved.');v.goto(base,wait_until='networkidle');expect(v.get_by_role('alert')).to_contain_text('no active Shepherd workspace')
 a.get_by_label('Full name',exact=True).fill('Browser Invitation');a.get_by_label('Email address',exact=True).fill('browser-invite-'+str(time.time_ns())+'@shepherd.test');a.get_by_role('button',name='Send invitation email',exact=True).click();expect(a.get_by_role('status').first).to_contain_text('Invitation sent',timeout=30000)
 a.goto(base+'/admin/audit',wait_until='networkidle');expect(a.get_by_text('member invited',exact=True)).to_be_visible();expect(a.get_by_text('import people',exact=True)).to_be_visible();a.set_viewport_size({'width':375,'height':812});assert a.evaluate('document.documentElement.scrollWidth <= innerWidth')
 checks.append('Administrator can disable access and send an invitation through the actual local edge function; audit history and mobile layout work')
 browser.close()
assert not errors,errors
print(json.dumps({'passed_checks':checks,'page_errors':errors},indent=2))
