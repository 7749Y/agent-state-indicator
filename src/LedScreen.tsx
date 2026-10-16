import { useEffect, useRef } from "react";
import { LedText, type LedTextOptions } from "./ledText";

/** LED 屏：zpix 像素字，文字超宽时由文本类无缝循环滚动。 */
export function LedScreen({ options }: { options: LedTextOptions }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const track = trackRef.current;
    const copy = copyRef.current;
    if (!panel || !track || !copy) return;

    const led = new LedText(panel, track, copy, options);
    led.start();
    return () => led.destroy();
  }, [options]);

  return (
    <div className="led-panel" ref={panelRef}>
      <div className="led-track" ref={trackRef}>
        <span className="led-text" ref={copyRef}>
          {options.text}
        </span>
        {/* 第二份用来接上循环 */}
        <span className="led-text" aria-hidden="true">
          {options.text}
        </span>
      </div>
    </div>
  );
}
