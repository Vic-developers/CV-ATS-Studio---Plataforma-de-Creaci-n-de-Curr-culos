"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { FileText, Minus, Plus, Printer } from "lucide-react";
import { documentBlocks, type Block, type ResumeData } from "@/domain/resume";
import { presentation } from "@/domain/presentation";

function Entry({ block, data }: { block: Block; data: ResumeData }) {
  const style = presentation(data, block.kind);
  const inline: CSSProperties = {
    fontSize: style.size,
    fontWeight: style.bold ? 700 : 400,
    paddingTop: style.before,
    paddingBottom: style.after,
    color: style.color,
    borderTop: style.border ? "1px solid " + style.color : undefined,
  };
  const Tag = block.kind === "heading" ? "h3" : "p";
  return (
    <Tag className={"preview-block " + block.kind} style={inline}>
      {block.kind === "bullet" && <span aria-hidden="true">• </span>}
      {block.text}
    </Tag>
  );
}

export function Preview({
  data,
  openPrint,
  canPrint,
}: {
  data: ResumeData;
  openPrint: () => void;
  canPrint: boolean;
}) {
  const [zoom, setZoom] = useState(100);
  const [width, setWidth] = useState(460);
  const [pages, setPages] = useState<number[][]>([[]]);
  const viewport = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const blocks = useMemo(() => documentBlocks(data), [data]);
  const scale = (Math.min(1, (width - 32) / 612) * zoom) / 100;
  const style = data.style;
  const flow = useCallback(() => {
    const nodes = Array.from(measure.current?.children ?? []);
    if (!nodes.length) {
      setPages([[]]);
      return;
    }
    const heights = nodes.map((el) => el.getBoundingClientRect().height);
    const result: number[][] = [[]];
    const limit = 792 - style.margin * 2;
    let used = 0;
    for (let i = 0; i < nodes.length; i++) {
      const keepNext =
        ["heading", "title", "label"].includes(blocks[i].kind) &&
        i < heights.length - 1
          ? heights[i + 1]
          : 0;
      if (used && used + heights[i] + Math.min(keepNext, limit / 3) > limit) {
        result.push([]);
        used = 0;
      }
      result.at(-1)!.push(i);
      used += heights[i];
    }
    setPages(result);
  }, [blocks, style.margin]);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const resize = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    resize.observe(el);
    return () => resize.disconnect();
  }, []);
  useEffect(() => {
    const el = measure.current;
    if (!el) return;
    flow();
    const resize = new ResizeObserver(flow);
    resize.observe(el);
    return () => resize.disconnect();
  }, [flow]);
  const paper: CSSProperties = {
    padding: style.margin,
    lineHeight: style.leading,
    fontFamily:
      style.font === "serif"
        ? "Noto Serif, Georgia, serif"
        : "Noto Sans, Arial, sans-serif",
  };
  return (
    <aside className="preview-panel" aria-label="Vista previa del currículum">
      <div className="preview-top">
        <div>
          <FileText size={18} />
          <strong>Vista previa</strong>
        </div>
        <div className="actions">
          <button
            className="icon-button"
            disabled={zoom <= 60}
            aria-label="Reducir zoom"
            onClick={() => setZoom(zoom - 10)}
          >
            <Minus size={16} />
          </button>
          <button
            className="zoom-label"
            aria-label="Restablecer zoom"
            onClick={() => setZoom(100)}
          >
            {zoom}%
          </button>
          <button
            className="icon-button"
            disabled={zoom >= 150}
            aria-label="Aumentar zoom"
            onClick={() => setZoom(zoom + 10)}
          >
            <Plus size={16} />
          </button>
          <button
            aria-label="Vista de impresión"
            title="Vista de impresión"
            className="icon-button"
            onClick={openPrint}
            disabled={!canPrint}
          >
            <Printer size={17} />
          </button>
        </div>
      </div>
      <div className="preview-viewport" ref={viewport}>
        <div className="paper-measure" aria-hidden="true">
          <div
            ref={measure}
            style={{ ...paper, padding: 0, width: 612 - style.margin * 2 }}
          >
            {blocks.map((block, i) => (
              <Entry block={block} data={data} key={i} />
            ))}
          </div>
        </div>
        {pages.map((indexes, p) => {
          const height = Math.max(
            792,
            indexes.reduce(
              (sum, i) =>
                sum +
                (measure.current?.children[i]?.getBoundingClientRect().height ??
                  0),
              style.margin * 2,
            ),
          );
          return (
            <div
              className="scaled-page"
              style={{
                width: Math.max(120, 612 * scale),
                height: Math.max(180, height * scale),
              }}
              key={p}
            >
              <article
                className="paper"
                style={{
                  ...paper,
                  transform: "scale(" + Math.max(0.2, scale) + ")",
                  minHeight: height,
                }}
              >
                {blocks.length ? (
                  indexes
                    .filter((i) => blocks[i])
                    .map((i) => <Entry block={blocks[i]} data={data} key={i} />)
                ) : (
                  <div className="paper-placeholder">
                    <p>Tu nombre</p>
                    <span>Título profesional</span>
                  </div>
                )}
              </article>
            </div>
          );
        })}
        <p className="preview-caption">
          {pages.length} {pages.length === 1 ? "página" : "páginas"} · Carta ·{" "}
          {style.mode === "ats" ? "Modo ATS" : "Modo visual"}
        </p>
      </div>
    </aside>
  );
}
