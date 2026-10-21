export type FeedbackOrder = {
  id: number;
  order_number?: string;
  status?: string;
  payment_status?: string;
  payment_method?: string | null;
  payment_preference?: string | null;
  delivery_status?: string;
  weight?: string | null;
  total_amount?: string;
  pickup_requested_at?: string | null;
  delivery_requested_at?: string | null;
  delivery_run?: { status: string; rider: { name: string; phone: string | null } } | null;
};

function snapshot(order: FeedbackOrder): string {
  return JSON.stringify([
    order.status, order.payment_status, order.payment_method, order.payment_preference,
    order.delivery_status, order.weight, order.total_amount, order.pickup_requested_at,
    order.delivery_requested_at, order.delivery_run?.status,
    order.delivery_run?.rider.name, order.delivery_run?.rider.phone,
  ]);
}

export function customerOrderFeedback(previous: FeedbackOrder[] | null, current: FeedbackOrder[]): { message: string; orderIds: number[] } | null {
  if (previous === null) return null;
  const before = new Map(previous.map(order => [order.id, order]));
  const changed = current.filter(order => !before.has(order.id) || snapshot(before.get(order.id)!) !== snapshot(order));
  if (!changed.length) return null;
  const orderIds = changed.map(order => order.id);
  if (changed.length > 1) return { message: `${changed.length} orders updated. Open Orders to see the changes.`, orderIds };
  const order = changed[0];
  const old = before.get(order.id);
  const number = order.order_number || `#${order.id}`;
  if (!old) return { message: `Booking received: ${number}.`, orderIds };
  const status = order.delivery_run?.status === "Started" ? "Out on delivery" : order.status;
  const oldStatus = old.delivery_run?.status === "Started" ? "Out on delivery" : old.status;
  if (status !== oldStatus) return { message: `${number}: now ${status}.`, orderIds };
  if (order.payment_status !== old.payment_status) return { message: `${number}: payment ${order.payment_status?.toLowerCase()}.`, orderIds };
  const details: string[] = [];
  if (order.weight !== old.weight || order.total_amount !== old.total_amount) {
    const weight = order.weight == null ? "not recorded" : `${Number(order.weight).toFixed(2)} kg`;
    const total = order.total_amount == null ? "not recorded" : `₱${Number(order.total_amount).toFixed(2)}`;
    details.push(`weight ${weight}; total ${total}`);
  }
  for (const [field, label] of [["pickup_requested_at", "requested pickup"], ["delivery_requested_at", "requested delivery"]] as const) {
    if (order[field] !== old[field]) {
      const value = order[field];
      const formatted = value ? new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) + " PHT" : "Not set";
      details.push(`${label}: ${formatted}`);
    }
  }
  return { message: `${number}: ${details.length ? details.join(". ") : "order details updated"}.`, orderIds };
}
