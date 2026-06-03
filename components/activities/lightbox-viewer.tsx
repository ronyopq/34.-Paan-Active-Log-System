"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFileIconClass } from "@/lib/file-icons";

export type LightboxFile = {
  id: string;
  name: string;
  type: "image" | "document";
  url: string;
  previewSrc?: string;
  sizeKb: number;
  category: string;
  entryId?: string;
};

type Props = {
  file: LightboxFile;
  files?: LightboxFile[];
  onClose: () => void;
};

export const LightboxViewer = ({ file, files, onClose }: Props) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentIndex, setCurrentIndex] = useState(0);
  const imageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const allFiles = useMemo(() => files ?? [file], [file, files]);

  useEffect(() => {
    const idx = allFiles.findIndex((f) => f.id === file.id && f.entryId === file.entryId);
    if (idx !== -1) setCurrentIndex(idx);
  }, [file, allFiles]);

  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.5, 5));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.5, 0.25));
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      switch (event.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          if (files && files.length > 1) setCurrentIndex((prev) => (prev - 1 + files.length) % files.length);
          break;
        case "ArrowRight":
          if (files && files.length > 1) setCurrentIndex((prev) => (prev + 1) % files.length);
          break;
        case "+":
        case "=":
          event.preventDefault();
          zoomIn();
          break;
        case "-":
          event.preventDefault();
          zoomOut();
          break;
        case "0":
          event.preventDefault();
          setScale(1);
          setPosition({ x: 0, y: 0 });
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [files, onClose, zoomIn, zoomOut]);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.25 : 0.25;
    setScale((prev) => Math.max(0.25, Math.min(5, prev + delta)));
  }, []);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (scale <= 1) return;
      setIsDragging(true);
      setDragStart({ x: event.clientX - position.x, y: event.clientY - position.y });
    },
    [scale, position]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isDragging) return;
      setPosition({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleBackgroundClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === containerRef.current) onClose();
    },
    [onClose]
  );

  const currentFile = allFiles[currentIndex];
  const isPrevNext = files && files.length > 1;
  const cursorStyle = isDragging ? "grabbing" : scale > 1 ? "grab" : "default";

  return (
    <div className="lightbox-overlay" ref={containerRef} onClick={handleBackgroundClick} onWheel={handleWheel}>
      <div className="lightbox-toolbar lightbox-toolbar-top">
        <div className="lightbox-file-info">
          <span className="lightbox-file-name">{currentFile.name}</span>
          <span className="lightbox-file-meta">
            {currentFile.category} &middot; {Math.max(1, currentFile.sizeKb)} KB
            {currentFile.entryId && <> &middot; {currentFile.entryId}</>}
          </span>
        </div>
        <div className="lightbox-actions">
          <button className="lightbox-btn" onClick={() => window.open(currentFile.url, "_blank")} title="Open in new tab">
            <i className="bi bi-box-arrow-up-right" />
          </button>
          <button
            className="lightbox-btn"
            onClick={() => {
              const a = document.createElement("a");
              a.href = currentFile.url;
              a.download = currentFile.name;
              a.click();
            }}
            title="Download"
          >
            <i className="bi bi-download" />
          </button>
          <button className="lightbox-btn lightbox-btn-close" onClick={onClose} title="Close (Esc)">
            <i className="bi bi-x-lg" />
          </button>
        </div>
      </div>

      <div className="lightbox-body">
        {isPrevNext && (
          <button
            className="lightbox-nav-btn lightbox-nav-prev"
            onClick={() => setCurrentIndex((prev) => (prev - 1 + (files?.length ?? 0)) % (files?.length ?? 1))}
          >
            <i className="bi bi-chevron-left" />
          </button>
        )}

        {currentFile.type === "image" ? (
          <div
            ref={imageRef}
            className="lightbox-image-wrap"
            style={{ cursor: cursorStyle }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentFile.previewSrc || currentFile.url}
              alt={currentFile.name}
              className="lightbox-image"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              }}
              draggable={false}
            />
          </div>
        ) : (
          <div className="lightbox-doc-placeholder">
            <i className={`bi ${getFileIconClass(currentFile.name)}`} />
            <p>Preview is not available for this file type.</p>
            <button className="lightbox-btn lightbox-btn-primary" onClick={() => window.open(currentFile.url, "_blank")}>
              <i className="bi bi-box-arrow-up-right" /> Open in new tab
            </button>
          </div>
        )}

        {isPrevNext && (
          <button
            className="lightbox-nav-btn lightbox-nav-next"
            onClick={() => setCurrentIndex((prev) => (prev + 1) % (files?.length ?? 1))}
          >
            <i className="bi bi-chevron-right" />
          </button>
        )}
      </div>

      {currentFile.type === "image" && (
        <div className="lightbox-zoom-bar">
          <button className="lightbox-btn" onClick={zoomOut} title="Zoom out (-)">
            <i className="bi bi-dash-lg" />
          </button>
          <span className="lightbox-zoom-label">{Math.round(scale * 100)}%</span>
          <button className="lightbox-btn" onClick={zoomIn} title="Zoom in (+)">
            <i className="bi bi-plus-lg" />
          </button>
          <button
            className="lightbox-btn"
            onClick={() => {
              setScale(1);
              setPosition({ x: 0, y: 0 });
            }}
            title="Reset zoom (0)"
          >
            <i className="bi bi-arrows-angle-expand" />
          </button>
          {isPrevNext && (
            <span className="lightbox-counter">
              {currentIndex + 1} / {files!.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
