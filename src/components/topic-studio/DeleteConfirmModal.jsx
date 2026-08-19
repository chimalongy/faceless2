"use client";

import { AlertTriangle, X } from "lucide-react";
import { createPortal } from "react-dom";

export default function DeleteConfirmModal({ mounted, deleteModal, closeDeleteModal }) {
  if (!mounted || !deleteModal.isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
      style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
    >
      <div className="relative w-full max-w-lg bg-paper border-2 border-rose-500/30 p-6 sm:p-8 shadow-2xl space-y-6 animate-scale-in text-ink my-auto">
        <button
          type="button"
          onClick={closeDeleteModal}
          className="absolute top-4 right-4 p-1.5 text-ink-muted hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer rounded-full"
          title="Cancel & Close"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
            <AlertTriangle size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-display font-semibold text-ink leading-snug">
              {deleteModal.title}
            </h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              {deleteModal.description}
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-rose-500/5 border border-rose-500/15 rounded-lg flex items-center gap-2.5 text-xs text-rose-700 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
          <span>Warning: This destructive action takes immediate effect in your studio state.</span>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
          <button
            type="button"
            onClick={closeDeleteModal}
            className="px-4 py-2 border border-line bg-paper-card text-xs font-semibold text-ink hover:bg-ink/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={deleteModal.onConfirm}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs shadow-rose-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            {deleteModal.confirmLabel || "Delete Permanently"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
