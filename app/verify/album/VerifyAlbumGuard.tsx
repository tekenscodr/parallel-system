"use client";

import React, { useEffect } from "react";

interface VerifyAlbumGuardProps {
  children: React.ReactNode;
}

export default function VerifyAlbumGuard({ children }: VerifyAlbumGuardProps) {
  useEffect(() => {
    const preventDefaultHandler = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const keydownHandler = (e: KeyboardEvent) => {
      const key = (e.key || "").toLowerCase();
      if (
        (e.ctrlKey || e.metaKey) &&
        (key === "c" ||
          key === "s" ||
          key === "p" ||
          key === "u" ||
          key === "a" ||
          key === "x")
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (
        e.key === "PrintScreen" ||
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (key === "i" || key === "j" || key === "c"))
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    const events = [
      "copy",
      "cut",
      "paste",
      "contextmenu",
      "selectstart",
      "dragstart",
    ];
    for (const evt of events) {
      document.addEventListener(evt, preventDefaultHandler, true);
    }
    document.addEventListener("keydown", keydownHandler, true);

    return () => {
      for (const evt of events) {
        document.removeEventListener(evt, preventDefaultHandler, true);
      }
      document.removeEventListener("keydown", keydownHandler, true);
    };
  }, []);

  return (
    <div
      className="select-none"
      style={{
        WebkitUserSelect: "none",
        MozUserSelect: "none",
        msUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <style>{`
        @media print {
          html, body {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>
      {children}
    </div>
  );
}
