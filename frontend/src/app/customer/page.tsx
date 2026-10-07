"use client";

import CustomerLiveUpdates from "@/components/CustomerLiveUpdates";
import CustomerAccount from "@/components/CustomerAccount";
import RequestedTimeFields from "@/components/RequestedTimeFields";
import { requestTimestamp, requestedTimeLabel } from "@/lib/requested-times";
import { API_URL } from "@/lib/api";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
};

type Address = {
  id: number;
  label: string | null;
  address: string;
  zone: string | null;
  notes: string | null;
  delivery_zone_id: number | null;
};

type Service = {
  id: number;
  name: string;
  pricing_type: "per_kg" | "fixed";
  rate: string;
  is_active: boolean;
};

type Order = {
  id: number;
  order_number: string;
  service_type: string;
  weight: string | null;
  total_amount: string;
  status: string;
  payment_status: string;
  payment_preference: string | null;
  payment_method: string | null;
  delivery_run?: { status: string; rider: { name: string; phone: string | null } } | null;
  delivery_status: string;
  requested_at: string | null;
  pickup_requested_at: string | null;
  delivery_requested_at: string | null;
};

export default function CustomerPage() {
  const router = useRouter();

  const [section, setSection] = useState("Home");
  const [user, setUser] = useState<User | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [orderFilter, setOrderFilter] = useState("Active");
  const [refreshingOrders, setRefreshingOrders] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [paymentPreference, setPaymentPreference] = useState("Cash");
  const [requestedTimes, setRequestedTimes] = useState({ pickup: "", delivery: "" });
  const [bookingNotes, setBookingNotes] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("washease_token");
    const storedUser = localStorage.getItem("washease_user");

    if (!token || !storedUser) {
      router.replace("/");
      return;
    }

    let parsedUser: User;

    try {
      parsedUser = JSON.parse(storedUser) as User;
    } catch {
      localStorage.removeItem("washease_token");
      localStorage.removeItem("washease_user");
      router.replace("/");
      return;
    }

    if (
      parsedUser.role === "admin" ||
      parsedUser.role === "staff"
    ) {
      router.replace("/dashboard");
      return;
    }

    if (parsedUser.role !== "customer") {
      localStorage.removeItem("washease_token");
      localStorage.removeItem("washease_user");
      router.replace("/");
      return;
    }

    async function loadCustomerData() {
      try {
        const headers = {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        };

        const [
          profileResponse,
          addressesResponse,
          servicesResponse,
          ordersResponse,
        ] = await Promise.all([
          fetch(`${API_URL}/customer/profile`, { headers }),
          fetch(`${API_URL}/addresses`, { headers }),
          fetch(`${API_URL}/services`, { headers }),
          fetch(`${API_URL}/orders`, { headers }),
        ]);

        if (
          profileResponse.status === 401 ||
          addressesResponse.status === 401 ||
          servicesResponse.status === 401 ||
          ordersResponse.status === 401
        ) {
          localStorage.removeItem("washease_token");
          localStorage.removeItem("washease_user");
          router.replace("/");
          return;
        }

        if (
          !profileResponse.ok ||
          !addressesResponse.ok ||
          !servicesResponse.ok ||
          !ordersResponse.ok
        ) {
          throw new Error("Unable to load customer information.");
        }

        const profileData = await profileResponse.json();
        const addressesData = await addressesResponse.json();
        const servicesData = await servicesResponse.json();
        const ordersData = await ordersResponse.json();

        const authenticatedUser = profileData.user as User;

        if (
          authenticatedUser.role === "admin" ||
          authenticatedUser.role === "staff"
        ) {
          localStorage.setItem(
            "washease_user",
            JSON.stringify(authenticatedUser)
          );

          router.replace("/dashboard");
          return;
        }

        if (authenticatedUser.role !== "customer") {
          localStorage.removeItem("washease_token");
          localStorage.removeItem("washease_user");
          router.replace("/");
          return;
        }

        localStorage.setItem(
          "washease_user",
          JSON.stringify(authenticatedUser)
        );

        setUser(authenticatedUser);
        setAddresses(Array.isArray(addressesData) ? addressesData : []);
        setServices(Array.isArray(servicesData) ? servicesData : []);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
      } catch (error) {
        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError("Unable to load customer information.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadCustomerData();
  }, [router]);

  useEffect(() => {
    const showOrder = () => { setOrderFilter("All"); setSection("Orders"); };
    window.addEventListener("washease:show-customer-order", showOrder);
    return () => window.removeEventListener("washease:show-customer-order", showOrder);
  }, []);

  async function handleBooking(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!selectedAddressId || !selectedServiceId) {
      setError("Please select an address and laundry service.");
      return;
    }

    const token = localStorage.getItem("washease_token");

    if (!token) {
      router.replace("/");
      return;
    }

    setIsBooking(true);

    try {
      const response = await fetch(`${API_URL}/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address_id: Number(selectedAddressId),
          service_id: Number(selectedServiceId),
          payment_preference: paymentPreference,
          notes: bookingNotes.trim() || null,
          pickup_requested_at: requestTimestamp(requestedTimes.pickup),
          delivery_requested_at: requestTimestamp(requestedTimes.delivery),
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem("washease_token");
        localStorage.removeItem("washease_user");
        router.replace("/");
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.errors ? Object.values(data.errors).flat().join(" ") : data?.message ?? "Unable to create booking."
        );
      }

      setOrders((currentOrders) => [
        data.order as Order,
        ...currentOrders,
      ]);

      setSelectedAddressId("");
      setSelectedServiceId("");
      setBookingNotes("");
      setRequestedTimes({ pickup: "", delivery: "" });

      setSection("Orders");
      setSuccess(
        `Booking ${data.order.order_number} was created successfully.`
      );
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Unable to create booking.");
      }
    } finally {
      setIsBooking(false);
    }
  }

  async function handleLogout() {
    const token = localStorage.getItem("washease_token");

    try {
      if (token) {
        await fetch(`${API_URL}/logout`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch {
      // Local session is still cleared if the server is unavailable.
    } finally {
      localStorage.removeItem("washease_token");
      localStorage.removeItem("washease_user");
      router.replace("/");
    }
  }

  async function refreshOrders() {
    setRefreshingOrders(true); setError("");
    try {
      const response = await fetch(`${API_URL}/orders`, { headers: { Accept: "application/json", Authorization: `Bearer ${localStorage.getItem("washease_token")}` } });
      if (response.status === 401) { localStorage.removeItem("washease_token"); localStorage.removeItem("washease_user"); router.replace("/"); return; }
      if (!response.ok) throw new Error("Unable to refresh orders. Existing information is still shown; try again.");
      setOrders(await response.json()); setLastRefreshed(new Date().toLocaleTimeString("en-PH"));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to refresh orders."); } finally { setRefreshingOrders(false); }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">
          Loading your WashEase account...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              WashEase
            </h1>

            <p className="text-sm text-slate-500">
              Customer Portal
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-4 pt-6 pb-32">
        <section hidden={section !== "Home"}>
          <p className="text-sm text-slate-500">
            Welcome back
          </p>

          <h2 className="text-2xl font-bold text-slate-900">
            {user?.name ?? "Customer"}
          </h2>
        </section>

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {user && <CustomerLiveUpdates onOrdersUpdated={setOrders} />}

        <div hidden={section !== "Account"}>{user && <CustomerAccount user={user} addresses={addresses} onProfileSaved={setUser} onAddressesSaved={(updated) => {
          setAddresses(updated);
          if (!updated.some(address => String(address.id) === selectedAddressId)) setSelectedAddressId("");
        }} />}</div>

        <section hidden={section !== "Home"} className="rounded-2xl bg-blue-700 p-6 text-white">
          <h2 className="text-xl font-semibold">Your laundry, at a glance</h2>
          <p className="mt-2">{orders.filter(order => order.status !== "Delivered").length} active orders</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => setSection("Book")} className="rounded-xl bg-white px-5 py-3 font-semibold text-blue-800">Book a pickup</button>
            <button type="button" onClick={() => setSection("Orders")} className="rounded-xl border border-blue-300 px-5 py-3 font-semibold">Track orders</button>
          </div>
        </section>
        <section hidden={section !== "Book"} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-slate-900">
              Book a pickup
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Choose where we should collect your laundry and the
              service you need.
            </p>
          </div>

          {addresses.length === 0 && <p className="mb-4 text-sm">Add a pickup address first. <button type="button" onClick={() => setSection("Account")} className="font-semibold text-blue-700 underline">Open Account</button></p>}
          <form onSubmit={handleBooking} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="booking-address"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Pickup address
                </label>

                <select
                  id="booking-address"
                  value={selectedAddressId}
                  onChange={(event) =>
                    setSelectedAddressId(event.target.value)
                  }
                  disabled={
                    isBooking || addresses.length === 0
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                >
                  <option value="">
                    Select an address
                  </option>

                  {addresses.map((address) => (
                    <option
                      key={address.id}
                      value={address.id}
                    >
                      {address.label
                        ? `${address.label} — ${address.address}`
                        : address.address}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="booking-service"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Laundry service
                </label>

                <select
                  id="booking-service"
                  value={selectedServiceId}
                  onChange={(event) =>
                    setSelectedServiceId(event.target.value)
                  }
                  disabled={
                    isBooking || services.length === 0
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                >
                  <option value="">
                    Select a service
                  </option>

                  {services.map((service) => (
                    <option
                      key={service.id}
                      value={service.id}
                    >
                      {service.name} — ₱
                      {Number(service.rate).toFixed(2)}
                      {service.pricing_type === "per_kg"
                        ? "/kg"
                        : " fixed"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="block text-sm font-medium text-slate-700">Payment on delivery
              <select value={paymentPreference} onChange={event => setPaymentPreference(event.target.value)} disabled={isBooking} className="mt-2 w-full rounded-xl border border-slate-300 p-3">
                <option value="Cash">Cash</option><option value="GCash">GCash</option>
              </select>
              <span className="mt-1 block text-xs text-slate-500">Pay the rider outside WashEase. This preference stays fixed after booking; staff confirms the actual method collected.</span>
            </label>
            <RequestedTimeFields value={requestedTimes} onChange={setRequestedTimes} disabled={isBooking} />
            <div>
              <label
                htmlFor="booking-notes"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Laundry / pickup instructions
              </label>

              <textarea
                id="booking-notes"
                value={bookingNotes}
                onChange={(event) =>
                  setBookingNotes(event.target.value)
                }
                placeholder="Optional instructions for your laundry pickup"
                rows={3}
                maxLength={500}
                disabled={isBooking}
                className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                For per-kilo services, the final amount is
                calculated after your laundry is weighed.
              </p>

              <button
                type="submit"
                disabled={
                  isBooking ||
                  addresses.length === 0 ||
                  services.length === 0
                }
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {isBooking
                  ? "Booking..."
                  : "Book pickup"}
              </button>
            </div>
          </form>
        </section>

        <section hidden={section !== "Book"} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-slate-900">
              Laundry services
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Current services and pricing available for booking.
            </p>
          </div>

          {services.length === 0 ? (
            <p className="text-sm text-slate-500">
              No laundry services are currently available.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="font-semibold text-slate-900">
                    {service.name}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    ₱{Number(service.rate).toFixed(2)}
                    {service.pricing_type === "per_kg"
                      ? " per kg"
                      : " fixed price"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section hidden={section !== "Orders"} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">
            Track your orders
          </h3>

          <div className="mt-4 flex flex-wrap gap-2">{["Active", "Completed", "All"].map(value => <button type="button" key={value} aria-pressed={orderFilter === value} onClick={() => setOrderFilter(value)} className={`rounded-lg border px-4 py-2 text-sm ${orderFilter === value ? "bg-slate-900 text-white" : "bg-white"}`}>{value}</button>)}<button type="button" disabled={refreshingOrders} onClick={refreshOrders} className="rounded-lg border px-4 py-2 text-sm">{refreshingOrders ? "Refreshing..." : "Refresh status"}</button></div><p className="mt-2 text-xs text-slate-600">Status reflects information reported by staff. Updates are checked automatically every 15 seconds while this page is visible.{lastRefreshed ? ` Last refreshed at ${lastRefreshed}.` : ""}</p>
          {orders.filter(order => orderFilter === "All" || (orderFilter === "Completed" ? order.status === "Delivered" : order.status !== "Delivered")).length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No orders in this view. Choose All to see your full history.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {orders.filter(order => orderFilter === "All" || (orderFilter === "Completed" ? order.status === "Delivered" : order.status !== "Delivered")).map((order) => (
                <div
                  key={order.id}
                  id={`customer-order-${order.id}`}
                  tabIndex={-1}
                  className="scroll-mt-24 focus:outline-2 focus:outline-blue-600 space-y-4 rounded-xl border border-slate-200 p-4"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {order.order_number}
                    </p>

                    <p className="text-sm text-slate-500">
                      {order.service_type}
                    </p>
                    <p className="text-xs text-slate-500">Payment preference: {order.payment_preference || "Not recorded"} · {order.payment_status}{order.payment_method ? ` via ${order.payment_method}` : ""}</p>
                    <p className="text-xs text-slate-600">Requested pickup: {requestedTimeLabel(order.pickup_requested_at)}<br />Requested delivery: {requestedTimeLabel(order.delivery_requested_at)}</p>
                    {order.delivery_run && <p className="text-xs text-slate-500">Rider: {order.delivery_run.rider.name} · {order.delivery_run.rider.phone || "Contact the shop"}</p>}
                  </div>

                  <ol aria-label="Order progress" className="flex flex-wrap gap-2">{["Pending", "Confirmed", "Picked Up", "Processing", "Ready for Delivery", "Delivered"].map((stage, index, stages) => <li key={stage} aria-current={stage === order.status ? "step" : undefined} className={`rounded-lg px-3 py-2 text-xs ${stage === order.status ? "bg-blue-700 font-semibold text-white" : index < stages.indexOf(order.status) ? "bg-emerald-50 text-emerald-900" : "bg-slate-100 text-slate-600"}`}>{stage === order.status ? "Current: " : ""}{stage}</li>)}</ol>
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {order.delivery_run?.status === "Started" && order.status !== "Delivered" ? "Out on delivery" : order.status}
                    </p>

                    <p className="text-sm text-slate-500">
                      {order.weight
                        ? `${order.weight} kg · ₱${Number(
                            order.total_amount
                          ).toFixed(2)}`
                        : Number(order.total_amount) > 0 ? `₱${Number(order.total_amount).toFixed(2)}` : "Final price pending weighing"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <nav aria-label="Customer navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-lg">
        <div className="mx-auto grid max-w-3xl grid-cols-4">{["Home", "Book", "Orders", "Account"].map((item, index) => <button key={item} type="button" aria-current={section === item ? "page" : undefined} onClick={() => { setSection(item); window.scrollTo({ top: 0, behavior: "instant" }); }} className={`flex min-h-16 flex-col items-center justify-center gap-1 px-2 py-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-blue-600 ${section === item ? "bg-blue-50 text-blue-800" : "text-slate-600"}`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={["M3 10 12 3l9 7v11h-6v-7H9v7H3Z", "M12 5v14M5 12h14", "M6 3h12v18H6ZM9 8h6M9 12h6M9 16h4", "M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0ZM4 21v-2a8 8 0 0 1 16 0v2"][index]} /></svg>{item}{item === "Orders" && orders.some(order => order.status !== "Delivered") ? ` (${orders.filter(order => order.status !== "Delivered").length})` : ""}
        </button>)}</div>
      </nav>
    </main>
  );
}