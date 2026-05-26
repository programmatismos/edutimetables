import { useUpdater } from "../hooks/useUpdater";
import { Download, RefreshCw, X, AlertCircle } from "lucide-react";

export function UpdateBanner() {
  const { state, download, install, dismiss } = useUpdater();

  if (state.status === "idle") return null;

  if (state.status === "available") {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl shadow-lg border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
        <Download size={18} className="text-blue-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-blue-900">Νέα έκδοση διαθέσιμη — v{state.version}</p>
          <p className="text-xs text-blue-700 mt-0.5">Κατεβάστε και εγκαταστήστε αυτόματα.</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={download}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Λήψη ενημέρωσης
            </button>
            <button
              onClick={dismiss}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white text-blue-700 border border-blue-200 hover:bg-blue-50"
            >
              Αργότερα
            </button>
          </div>
        </div>
        <button onClick={dismiss} className="text-blue-400 hover:text-blue-600">
          <X size={14} />
        </button>
      </div>
    );
  }

  if (state.status === "downloading") {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl shadow-lg border border-blue-200 bg-blue-50 p-4 flex items-center gap-3">
        <RefreshCw size={18} className="text-blue-600 animate-spin shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-blue-900">Λήψη ενημέρωσης… {state.percent}%</p>
          <div className="mt-2 h-1.5 rounded-full bg-blue-200 overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${state.percent}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "ready") {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl shadow-lg border border-green-200 bg-green-50 p-4 flex items-start gap-3">
        <RefreshCw size={18} className="text-green-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-green-900">Έτοιμο για εγκατάσταση — v{state.version}</p>
          <p className="text-xs text-green-700 mt-0.5">Η εφαρμογή θα επανεκκινήσει.</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={install}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700"
            >
              Εγκατάσταση & επανεκκίνηση
            </button>
            <button
              onClick={dismiss}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white text-green-700 border border-green-200 hover:bg-green-50"
            >
              Αργότερα
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl shadow-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
        <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-900">Σφάλμα ενημέρωσης</p>
          <p className="text-xs text-red-700 mt-1 break-words">{state.message}</p>
        </div>
        <button onClick={dismiss} className="text-red-400 hover:text-red-600">
          <X size={14} />
        </button>
      </div>
    );
  }

  return null;
}
