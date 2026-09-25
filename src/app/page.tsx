import { Suspense } from "react";
import PatientDashboard from "@/components/PatientDashboard";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="flex items-center space-x-3 text-slate-500">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Loading EHR Dashboard...</span>
          </div>
        </div>
      }
    >
      <PatientDashboard />
    </Suspense>
  );
}
