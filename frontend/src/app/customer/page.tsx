"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: number;
  name: string;
  email: string;
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
  delivery_status: string;
  requested_at: string | null;
};

const API_URL = "http://127.0.0.1:8000/api";

export default function CustomerPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
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
          notes: bookingNotes.trim() || null,
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
          data?.message ?? "Unable to create booking."
        );
      }

      setOrders((currentOrders) => [
        data.order as Order,
        ...currentOrders,
      ]);

      setSelectedAddressId("");
      setSelectedServiceId("");
      setBookingNotes("");

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

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <section>
          <p className="text-sm text-slate-500">
            Welcome back
          </p>

          <h2 className="text-2xl font-bold text-slate-900">
            {user?.name ?? "Customer"}
          </h2>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Saved addresses
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {addresses.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Available services
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {services.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Your orders
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {orders.length}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-slate-900">
              Book a pickup
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Choose where we should collect your laundry and the
              service you need.
            </p>
          </div>

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

            <div>
              <label
                htmlFor="booking-notes"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Pickup notes
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

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">
            Recent orders
          </h3>

          {orders.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              You have not placed any orders yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {order.order_number}
                    </p>

                    <p className="text-sm text-slate-500">
                      {order.service_type}
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <p className="text-sm font-medium text-slate-700">
                      {order.status}
                    </p>

                    <p className="text-sm text-slate-500">
                      {order.weight
                        ? `${order.weight} kg · ₱${Number(
                            order.total_amount
                          ).toFixed(2)}`
                        : "Awaiting laundry weight"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}