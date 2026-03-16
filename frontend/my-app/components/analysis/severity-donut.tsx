"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SeverityDonutProps {
  high: number;
  medium: number;
  low: number;
}

export function SeverityDonut({ high, medium, low }: SeverityDonutProps) {
  const total = high + medium + low;
  const radius = 40;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;

  // Compute dash segments (high → medium → low)
  const highPct = total > 0 ? high / total : 0;
  const medPct = total > 0 ? medium / total : 0;
  const lowPct = total > 0 ? low / total : 0;

  const highDash = circumference * highPct;
  const medDash = circumference * medPct;
  const lowDash = circumference * lowPct;

  // Each segment is offset by the sum of all previous segments
  const highOffset = 0;
  const medOffset = circumference - highDash;
  const lowOffset = circumference - highDash - medDash;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Severity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          {/* SVG donut */}
          <div className="relative h-[100px] w-[100px] shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              {/* Background ring */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth={stroke}
              />
              {total > 0 && (
                <>
                  {/* Low (yellow) — drawn first (bottom layer) */}
                  {lowPct > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="none"
                      stroke="#eab308"
                      strokeWidth={stroke}
                      strokeDasharray={`${lowDash} ${circumference - lowDash}`}
                      strokeDashoffset={-highDash - medDash}
                      strokeLinecap="round"
                    />
                  )}
                  {/* Medium (orange) */}
                  {medPct > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="none"
                      stroke="#f97316"
                      strokeWidth={stroke}
                      strokeDasharray={`${medDash} ${circumference - medDash}`}
                      strokeDashoffset={-highDash}
                      strokeLinecap="round"
                    />
                  )}
                  {/* High (red) — drawn last (top layer) */}
                  {highPct > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth={stroke}
                      strokeDasharray={`${highDash} ${circumference - highDash}`}
                      strokeDashoffset={0}
                      strokeLinecap="round"
                    />
                  )}
                </>
              )}
            </svg>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold leading-none">{total}</span>
              <span className="text-[10px] text-muted-foreground">flagged</span>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500 shrink-0" />
              <span className="font-medium">{high}</span>
              <span className="text-muted-foreground">High</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-orange-500 shrink-0" />
              <span className="font-medium">{medium}</span>
              <span className="text-muted-foreground">Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-yellow-500 shrink-0" />
              <span className="font-medium">{low}</span>
              <span className="text-muted-foreground">Low</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
