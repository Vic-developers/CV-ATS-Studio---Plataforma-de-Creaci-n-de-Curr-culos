"use client";
import { FileText, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <FileText size={20} strokeWidth={2.3} />
      </span>
      <span>
        CV ATS <b>Studio</b>
      </span>
    </div>
  );
}
export function Notice({
  children,
  kind = "error",
}: {
  children: ReactNode;
  kind?: "error" | "success" | "info";
}) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={"notice " + kind}
    >
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button aria-label="Cerrar" className="icon-button" onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <FileText size={25} />
      </span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
