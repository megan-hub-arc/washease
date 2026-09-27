import AdminShell from "@/components/admin/AdminShell";

export default function DashboardPage() {
  return (
    <AdminShell title="Overview">
      <section>
        <h2 className="text-xl font-bold text-[#17395d]">
          Overview
        </h2>

        <p className="mt-1 text-sm text-[#7892ad]">
          WashEase operations at a glance.
        </p>

        <div className="mt-6 rounded-xl border border-[#dbe7f3] bg-white p-6">
          <p className="font-semibold text-[#17395d]">
            Admin interface ready.
          </p>

          <p className="mt-1 text-sm text-[#7892ad]">
            Dashboard data will be connected in the next step.
          </p>
        </div>
      </section>
    </AdminShell>
  );
}