"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SeverityBadge } from "./severity-badge";

interface BlockNavigatorProps {
  currentBlock: number;
  totalBlocks: number;
  currentConfidence?: "HIGH" | "MEDIUM" | "LOW";
  onPrev: () => void;
  onNext: () => void;
}

export function BlockNavigator({
  currentBlock,
  totalBlocks,
  currentConfidence,
  onPrev,
  onNext,
}: BlockNavigatorProps) {
  if (totalBlocks === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={onPrev}
        disabled={currentBlock <= 1}
      >
        <ChevronLeft className="h-4 w-4" />
        Prev
      </Button>
      <span className="text-sm font-medium text-muted-foreground">
        Block {currentBlock} of {totalBlocks}
      </span>
      {currentConfidence && <SeverityBadge level={currentConfidence} />}
      <Button
        variant="outline"
        size="sm"
        onClick={onNext}
        disabled={currentBlock >= totalBlocks}
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
