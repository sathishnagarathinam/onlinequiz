import AdminLayout from "../components/AdminLayout";

export default function ResultListPage() {
  return (
    <AdminLayout>
      <div className="bg-white rounded-lg border border-brand-100 p-10 text-center shadow-sm">
        <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-brand-50 flex items-center justify-center">
          <svg
            className="h-8 w-8 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          All Results
        </h2>
        <p className="text-sm text-slate-500">
          Results listing and management UI coming soon.
        </p>
      </div>
    </AdminLayout>
  );
}
