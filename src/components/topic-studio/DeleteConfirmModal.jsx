"use client";

import { AlertTriangle, X, Loader2, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export default function DeleteConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  deleteModal,
  closeDeleteModal,
}) {
  const [mounted, setMounted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const open = isOpen ?? deleteModal?.isOpen ?? false;
  const modalTitle = title ?? deleteModal?.title ?? "Confirm Deletion";
  const modalDesc = description ?? deleteModal?.description ?? "Are you sure you want to delete this item?";
  const confirmText = confirmLabel ?? deleteModal?.confirmLabel ?? "Delete";
  const handleConfirm = onConfirm ?? deleteModal?.onConfirm ?? (() => {});
  const handleCancel = onCancel ?? closeDeleteModal ?? (() => {});

  async function executeConfirm() {
    setIsDeleting(true);
    try {
      await handleConfirm();
    } catch (err) {
      console.error("Error during deletion execution:", err);
    } finally {
      setIsDeleting(false);
      handleCancel();
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
      style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) handleCancel();
      }}
    >
      <div className="relative w-full max-w-md bg-paper border-2 border-rose-500/30 p-6 sm:p-8 shadow-2xl space-y-6 animate-scale-in text-ink my-auto">
        <button
          type="button"
          disabled={isDeleting}
          onClick={handleCancel}
          className="absolute top-4 right-4 p-1.5 text-ink-muted hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer rounded-full disabled:opacity-50"
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
              {modalTitle}
            </h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              {modalDesc}
            </p>
          </div>
        </div>

        <div className="p-3 bg-rose-500/5 border border-rose-500/15 rounded-sm flex items-center gap-2.5 text-xs text-rose-700 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
          <span>Warning: This destructive action will delete the asset from Cloudflare R2 and database.</span>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleCancel}
            className="px-4 py-2 border border-line bg-paper-card text-xs font-semibold text-ink hover:bg-ink/5 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={executeConfirm}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold shadow-xs shadow-rose-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            {isDeleting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 size={13} />
                <span>{confirmText || "Delete Permanently"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
