import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/customer-feedback.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
const feedback = exports.customerOrderFeedback;
const order = { id: 1, order_number: 'WS-DEMO', status: 'Confirmed', payment_status: 'Unpaid', delivery_run: null };
test('initial history and unchanged or reordered snapshots produce no popup', () => {
  assert.equal(feedback(null, [order]), null);
  assert.equal(feedback([order], [{ ...order }]), null);
  assert.equal(feedback([order, { ...order, id: 2 }], [{ ...order, id: 2 }, order]), null);
});
test('status and departure updates identify the changed order with readable feedback', () => {
  assert.equal(feedback([order], [{ ...order, status: 'Processing' }]).message, 'WS-DEMO: now Processing.');
  const departed = { ...order, delivery_run: { status: 'Started', rider: { name: 'Rider', phone: null } } };
  const result = feedback([order], [departed]);
  assert.equal(result.message, 'WS-DEMO: now Out on delivery.');
  assert.equal(JSON.stringify(result.orderIds), '[1]');
  assert.equal(feedback([departed], [departed]), null);
});
test('payment and requested time changes produce feedback without using notification read state', () => {
  assert.equal(feedback([order], [{ ...order, payment_status: 'Paid' }]).message, 'WS-DEMO: payment paid.');
  assert.match(feedback([order], [{ ...order, delivery_requested_at: '2026-10-15T14:00:00+08:00' }]).message, /requested delivery:.*Oct 15, 2026.*2:00.*PHT/);
  assert.equal(feedback([order], [{ ...order, updated_at: 'new', unread_count: 9 }]), null);
});
test('new bookings and simultaneous updates are summarized', () => {
  assert.equal(feedback([], [order]).message, 'Booking received: WS-DEMO.');
  const result = feedback([order], [{ ...order, status: 'Processing' }, { ...order, id: 2 }]);
  assert.equal(result.message, '2 orders updated. Open Orders to see the changes.');
  assert.equal(JSON.stringify(result.orderIds), '[1,2]');
});

test('weighing and schedule feedback includes the actual values and cleared times', () => {
  const weighed = { ...order, weight: '3.00', total_amount: '105.00' };
  assert.equal(feedback([order], [weighed]).message, 'WS-DEMO: weight 3.00 kg; total ₱105.00.');
  assert.equal(feedback([weighed], [weighed]), null);
  const changed = feedback([weighed], [{ ...weighed, weight: '4.00', total_amount: '140.00', pickup_requested_at: '2026-10-22T01:00:00Z' }]);
  assert.match(changed.message, /4.00 kg; total ₱140.00.*requested pickup:.*9:00.*PHT/);
  assert.match(feedback([{ ...order, delivery_requested_at: '2026-10-22T01:00:00Z' }], [order]).message, /requested delivery: Not set/);
});
