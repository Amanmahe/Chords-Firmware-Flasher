"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { Info, TriangleAlert } from "lucide-react";

/**
 * Small "i" button that explains a section (or, with `warning`, an amber
 * triangle that explains why something isn't available). Hovering shows the popover until
 * the pointer leaves; a click (or tap) pins it open. The popover is fixed to
 * the window so scrolling panels can't clip it.
 */
export function InfoButton({
  label,
  warning = false,
  children,
}: {
  label: string;
  warning?: boolean;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<CSSProperties | null>(null);
  const [pinned, setPinned] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  };

  useEffect(() => cancelHide, []);

  useEffect(() => {
    if (!pos) return;
    const close = () => {
      setPos(null);
      setPinned(false);
    };
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!popoverRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // Close if the button moves; other scrolling (like the log) is ignored.
    const onScroll = (e: Event) => {
      if (e.target === document || (e.target instanceof Node && e.target.contains(buttonRef.current))) close();
    };
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [pos]);

  const placePopover = (): CSSProperties | null => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 18 * rem - 8));
    // Open upward from the lower part of the window.
    return rect.bottom > window.innerHeight * 0.6
      ? { left, bottom: window.innerHeight - rect.top + 6 }
      : { left, top: rect.bottom + 6 };
  };

  const show = () => {
    cancelHide();
    if (!pos) setPos(placePopover());
  };

  // A short delay lets the pointer cross the gap from the button to the popover.
  const hideSoon = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || pinned) return;
    cancelHide();
    hideTimer.current = setTimeout(() => setPos(null), 150);
  };

  const toggle = () => {
    cancelHide();
    if (pinned) {
      setPinned(false);
      setPos(null);
    } else {
      setPinned(true);
      if (!pos) setPos(placePopover());
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        onPointerEnter={(e) => e.pointerType === "mouse" && show()}
        onPointerLeave={hideSoon}
        onFocus={show}
        onBlur={(e) => !pinned && !popoverRef.current?.contains(e.relatedTarget as Node) && setPos(null)}
        aria-label={`About ${label}`}
        aria-expanded={!!pos}
        className={`shrink-0 rounded-full transition-colors ${
          warning
            ? `hover:text-amber-200 ${pos ? "text-amber-200" : "text-amber-400"}`
            : `hover:text-blue-300 ${pos ? "text-blue-300" : "text-blue-400"}`
        }`}
      >
        {/* A slightly larger, bolder icon than the text around it stays sharp
            when the page scales to small sizes. */}
        {warning ? (
          <TriangleAlert className="h-4 w-4" strokeWidth={2.25} />
        ) : (
          <Info className="h-4 w-4" strokeWidth={2.25} />
        )}
      </button>
      {pos && (
        <div
          ref={popoverRef}
          role="tooltip"
          style={pos}
          onPointerEnter={cancelHide}
          onPointerLeave={hideSoon}
          className="fixed z-50 w-[18rem] rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-left font-sans text-xs font-normal leading-relaxed text-neutral-300 shadow-2xl shadow-black/60"
        >
          {children}
        </div>
      )}
    </>
  );
}
