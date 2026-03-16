"use client";

interface ThresholdSliderProps {
  value: number; // 0-100
  onChange: (value: number) => void;
  flaggedCount: number;
  clearCount: number;
}

export function ThresholdSlider({
  value,
  onChange,
  flaggedCount,
  clearCount,
}: ThresholdSliderProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
        style={{ minWidth: 80 }}
      />
      <span className="text-xs font-mono font-semibold w-8 text-right tabular-nums">
        {(value / 100).toFixed(2)}
      </span>
      <span className="text-[10px] rounded bg-red-500/15 text-red-500 px-1.5 py-0.5 font-medium tabular-nums">
        {flaggedCount}
      </span>
    </div>
  );
}
