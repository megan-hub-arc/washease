import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { API_URL } from "@/lib/api";

export function connectCustomerLive(onChange: () => void, onStatus: (connected: boolean) => void): () => void {
  onStatus(false);
  const key = process.env.NEXT_PUBLIC_REVERB_APP_KEY;
  const host = process.env.NEXT_PUBLIC_REVERB_HOST;
  const token = localStorage.getItem("washease_token");
  if (!key || !host || !token) return () => {};
  let customerId: number;
  try {
    const user = JSON.parse(localStorage.getItem("washease_user") || "null");
    if (user?.role !== "customer" || !Number.isInteger(user.id)) return () => {};
    customerId = user.id;
  } catch { return () => {}; }
  const secure = process.env.NEXT_PUBLIC_REVERB_SCHEME === "https";
  const port = Number(process.env.NEXT_PUBLIC_REVERB_PORT || (secure ? 443 : 8080));
  const echo = new Echo({
    broadcaster: "reverb", Pusher, key, wsHost: host, wsPort: port, wssPort: port,
    forceTLS: secure, enabledTransports: ["ws", "wss"],
    authEndpoint: `${API_URL}/customer/broadcasting/auth`,
    auth: { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
  });
  const channel = echo.private(`customers.${customerId}`);
  channel.listen(".orders.changed", onChange);
  channel.subscribed(() => { onStatus(true); onChange(); });
  channel.error(() => onStatus(false));
  const connection = echo.connector.pusher.connection;
  const lost = () => onStatus(false);
  const stateChanged = ({ current }: { current: string }) => { if (current !== "connected") onStatus(false); };
  connection.bind("state_change", stateChanged);
  connection.bind("disconnected", lost);
  connection.bind("unavailable", lost);
  connection.bind("error", lost);
  return () => {
    connection.unbind("state_change", stateChanged);
    connection.unbind("disconnected", lost);
    connection.unbind("unavailable", lost);
    connection.unbind("error", lost);
    echo.leave(`customers.${customerId}`);
    echo.disconnect();
  };
}
