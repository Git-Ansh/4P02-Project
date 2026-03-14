"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown, Eye } from "lucide-react";
import { SeverityBadge, getSeverityLevel } from "./severity-badge";
import type { AnalysisPair } from "@/lib/types/analysis";

interface PairRankingTableProps {
  pairs: AnalysisPair[];
  onViewPair?: (pairId: string) => void;
}

type SortKey = "severity_score" | "similarity" | "total_blocks" | "high_confidence_blocks" | "average_density";

export function PairRankingTable({ pairs, onViewPair }: PairRankingTableProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>("severity_score");
  const [sortDesc, setSortDesc] = React.useState(true);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const sorted = React.useMemo(() => {
    const copy = [...pairs];
    copy.sort((a, b) => {
      let va: number, vb: number;
      switch (sortKey) {
        case "similarity":
          va = a.similarity;
          vb = b.similarity;
          break;
        case "total_blocks":
          va = a.summary.total_blocks;
          vb = b.summary.total_blocks;
          break;
        case "high_confidence_blocks":
          va = a.summary.high_confidence_blocks;
          vb = b.summary.high_confidence_blocks;
          break;
        case "average_density":
          va = a.summary.average_density;
          vb = b.summary.average_density;
          break;
        default:
          va = a.severity_score;
          vb = b.severity_score;
      }
      return sortDesc ? vb - va : va - vb;
    });
    return copy;
  }, [pairs, sortKey, sortDesc]);

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <button
      className="inline-flex items-center gap-1 hover:text-foreground"
      onClick={() => handleSort(field)}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Flagged Pairs</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Pair</TableHead>
                <TableHead>
                  <SortHeader label="Similarity" field="similarity" />
                </TableHead>
                <TableHead>
                  <SortHeader label="Severity" field="severity_score" />
                </TableHead>
                <TableHead>
                  <SortHeader label="Blocks" field="total_blocks" />
                </TableHead>
                <TableHead>
                  <SortHeader label="High Conf." field="high_confidence_blocks" />
                </TableHead>
                <TableHead>
                  <SortHeader label="Avg Density" field="average_density" />
                </TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No flagged pairs found.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((pair, idx) => (
                  <TableRow key={pair.pair_id}>
                    <TableCell className="font-medium text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      {pair.student_1} vs {pair.student_2}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.round(pair.similarity * 100)}%`,
                              background:
                                pair.similarity >= 0.7
                                  ? "#ef4444"
                                  : pair.similarity >= 0.4
                                    ? "#f97316"
                                    : "#eab308",
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {Math.round(pair.similarity * 100)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-bold"
                          style={{
                            color:
                              pair.severity_score >= 0.7
                                ? "#ef4444"
                                : pair.severity_score >= 0.4
                                  ? "#f97316"
                                  : "#eab308",
                          }}
                        >
                          {pair.severity_score.toFixed(2)}
                        </span>
                        <SeverityBadge level={getSeverityLevel(pair.severity_score)} />
                      </div>
                    </TableCell>
                    <TableCell>{pair.summary.total_blocks}</TableCell>
                    <TableCell>
                      {pair.summary.high_confidence_blocks > 0 && (
                        <span className="inline-flex items-center rounded-full bg-red-500/15 px-1.5 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
                          {pair.summary.high_confidence_blocks}
                        </span>
                      )}
                      {pair.summary.high_confidence_blocks === 0 && "0"}
                    </TableCell>
                    <TableCell>
                      {Math.round(pair.summary.average_density * 100)}%
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewPair?.(pair.pair_id)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
