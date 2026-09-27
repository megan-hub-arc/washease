"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

type User = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
};

type AdminShellProps = {
  children: ReactNode;
  title: string;
};

const navigation = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: "▦",
  },
  {
    section: "OPERATIONS",
    items: [
      { label: "Orders", href: "/orders", icon: "▣" },
      { label: "Deliveries", href: "/deliveries", icon: "▱" },
      { label: "Customers", href: "/customers", icon: "♙" },
      { label: "Riders", href: "/riders", icon: "♧" },
    ],
  },
  {
    section: "FINANCE",
    items: [
      { label: "Payments", href: "/payments", icon: "▤" },
      { label: "Reports", href: "/reports", icon: "▥" },
    ],
  },
  {
    section: "SYSTEM",
    items: [
      { label: "Zones", href: "/zones", icon: "⌖" },
      { label: "Settings", href: "/settings", icon: "⚙" },
    ],
  },
];

export default function AdminShell({
  children,
  title,
}: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("washease_token");
    const storedUser = localStorage.getItem("washease_user");

    if (!token || !storedUser) {
      router.replace("/");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser) as User;

      if (
        parsedUser.role !== "admin" &&
        parsedUser.role !== "staff"
      ) {
        localStorage.removeItem("washease_token");
        localStorage.removeItem("washease_user");
        router.replace("/");
        return;
      }

      setUser(parsedUser);
    } catch {
      localStorage.removeItem("washease_token");
      localStorage.removeItem("washease_user");
      router.replace("/");
    }
  }, [router]);

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f8fe]">
        <p className="text-sm text-slate-500">
          Loading WashEase...
        </p>
      </main>
    );
  }

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function isActive(href: string) {
    return pathname === href;
  }

  return (
    <div className="min-h-screen bg-[#f3f8fe] text-[#17395d]">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/20 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col border-r border-[#dbe7f3] bg-white transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-[#dbe7f3] px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#173f66] text-sm font-bold text-white">
              W
            </div>

            <div>
              <p className="text-sm font-bold text-[#12385c]">
                {user.role === "admin" ? "admin" : user.name}
              </p>

              <p className="mt-1 text-xs text-[#7892ad]">
                Admin Dashboard
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-5">
          <Link
            href="/dashboard"
            onClick={() => setSidebarOpen(false)}
            className={`mb-5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
              isActive("/dashboard")
                ? "bg-[#e7f2ff] font-medium text-[#123f67]"
                : "text-[#4f7192] hover:bg-[#f4f8fc]"
            }`}
          >
            <span className="w-5 text-center text-[#42a5e9]">
              ▦
            </span>
            Overview
          </Link>

          {navigation.slice(1).map((group) => (
            <div key={group.section} className="mb-5">
              <p className="mb-2 px-2 text-[10px] font-bold tracking-[0.08em] text-[#9bb0c4]">
                {group.section}
              </p>

              <div className="space-y-1">
                {group.items?.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                      isActive(item.href)
                        ? "bg-[#e7f2ff] font-medium text-[#123f67]"
                        : "text-[#4f7192] hover:bg-[#f4f8fc]"
                    }`}
                  >
                    <span className="w-5 text-center text-[#79add5]">
                      {item.icon}
                    </span>

                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-[#dbe7f3] px-4 py-3 text-[11px] text-[#9bb0c4]">
          v1.0.0 · WashEase
        </div>
      </aside>

      <div className="lg:pl-[220px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#dbe7f3] bg-white px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Toggle navigation"
              onClick={() => setSidebarOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#dbe7f3] bg-[#f4f8fc] text-xl text-[#173f66]"
            >
              ☰
            </button>

            <h1 className="text-lg font-semibold text-[#17395d]">
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-[#17395d]">
                {user.name}
              </p>
              <p className="text-[11px] capitalize text-[#8ba2b8]">
                {user.role}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#173f66] text-xs font-bold text-white">
              {initials}
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}