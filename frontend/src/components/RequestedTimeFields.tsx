"use client";

export type RequestedTimes = { pickup: string; delivery: string };
export default function RequestedTimeFields({ value, onChange, disabled = false }: {
  value: RequestedTimes; onChange: (value: RequestedTimes) => void; disabled?: boolean;
}) {
  const input = "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-blue-600 disabled:bg-slate-100";
  return <fieldset disabled={disabled} className="space-y-3">
    <legend className="text-sm font-semibold text-slate-800">Requested times (optional)</legend>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="text-sm font-medium text-slate-700">Pickup date and time<input type="datetime-local" className={input} value={value.pickup} onChange={event => onChange({ ...value, pickup: event.target.value })} /></label>
      <label className="text-sm font-medium text-slate-700">Delivery date and time<input type="datetime-local" className={input} value={value.delivery} onChange={event => onChange({ ...value, delivery: event.target.value })} /></label>
    </div>
    <p className="text-xs text-slate-600">All times are Philippine time (PHT). New requests must be in the future; delivery must be after pickup. Requests are subject to staff review and laundry processing time. Leave blank if no time was requested.</p>
  </fieldset>;
}
