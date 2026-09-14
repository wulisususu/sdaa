"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import styles from "./coverage-stage.module.css";

export interface CoverageScrollRegionProps {
  children: ReactNode;
  ariaLabel: string;
  className?: string;
}

export function CoverageScrollRegion({
  children,
  ariaLabel,
  className
}: CoverageScrollRegionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [shadowTop, setShadowTop] = useState(false);
  const [shadowBottom, setShadowBottom] = useState(false);

  const updateEdges = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;

    const maxScrollTop = Math.max(0, node.scrollHeight - node.clientHeight);
    setShadowTop(node.scrollTop > 1);
    setShadowBottom(node.scrollTop < maxScrollTop - 1);
  }, []);

  useEffect(() => {
    updateEdges();

    const node = scrollRef.current;
    if (!node) return;

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateEdges);

    observer?.observe(node);
    window.addEventListener("resize", updateEdges);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateEdges);
    };
  }, [children, updateEdges]);

  return (
    <div
      className={`${styles.scrollFrame} ${className ?? ""}`}
      data-shadow-top={shadowTop ? "true" : "false"}
      data-shadow-bottom={shadowBottom ? "true" : "false"}
    >
      <div
        ref={scrollRef}
        className={styles.scrollRegion}
        data-coverage-scroll-region="true"
        tabIndex={0}
        aria-label={ariaLabel}
        onScroll={updateEdges}
      >
        {children}
      </div>
    </div>
  );
}
