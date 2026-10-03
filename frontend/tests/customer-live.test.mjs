import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(env = {}, user = { id: 7, role: 'customer' }) {
  const handlers = {};
  const calls = [];
  let options;
  const connection = { bind: (name, cb) => { handlers[name] = cb; }, unbind: name => calls.push(`unbind:${name}`) };
  class Echo {
    constructor(value) { options = value; this.connector = { pusher: { connection } }; }
    private(name) { calls.push(name); return {
      listen: (name, cb) => { handlers[name] = cb; },
      subscribed: cb => { handlers.subscribed = cb; }, error: cb => { handlers.error = cb; },
    }; }
    leave(name) { calls.push(`leave:${name}`); }
    disconnect() { calls.push('disconnect'); }
  }
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/lib/customer-live.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports, process: { env },
    localStorage: { getItem: key => key === 'washease_token' ? 'test-token' : JSON.stringify(user) },
    require: name => name === 'laravel-echo' ? Echo : name === 'pusher-js' ? class Pusher {} : { API_URL: 'http://localhost:8000/api' },
  });
  return { connect: exports.connectCustomerLive, handlers, calls, options: () => options };
}

test('missing Reverb configuration leaves periodic checks available', () => {
  const h = harness();
  h.connect(() => assert.fail('unexpected update'), () => {})();
  assert.equal(h.options(), undefined);
});

test('private subscription uses bearer auth, reports readiness, updates and disconnection, and cleans up', () => {
  const h = harness({ NEXT_PUBLIC_REVERB_APP_KEY: 'public-key', NEXT_PUBLIC_REVERB_HOST: 'localhost' });
  let updates = 0;
  const states = [];
  const stop = h.connect(() => updates++, state => states.push(state));
  assert.equal(h.options().auth.headers.Authorization, 'Bearer test-token');
  assert.equal(h.options().authEndpoint, 'http://localhost:8000/api/customer/broadcasting/auth');
  assert.equal(h.calls[0], 'customers.7');
  h.handlers.subscribed();
  h.handlers['.orders.changed']();
  h.handlers.unavailable();
  assert.equal(updates, 2);
  assert.deepEqual(states, [false, true, false]);
  stop();
  assert.ok(h.calls.includes('leave:customers.7'));
  assert.ok(h.calls.includes('disconnect'));
});

test('staff cannot initiate a customer live subscription', () => {
  const h = harness({ NEXT_PUBLIC_REVERB_APP_KEY: 'key', NEXT_PUBLIC_REVERB_HOST: 'localhost' }, { id: 7, role: 'staff' });
  h.connect(() => {}, () => {})();
  assert.equal(h.options(), undefined);
});
