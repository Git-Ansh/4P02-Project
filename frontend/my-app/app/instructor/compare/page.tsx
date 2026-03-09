"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  FileSearch,
  Loader2,
  Sparkles,
  ArrowLeftRight,
  Code2,
  Percent,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface CompareBlock {
  id: string;
  leftStartLine: number;
  leftEndLine: number;
  rightStartLine: number;
  rightEndLine: number;
  similarity: number;
  matched: boolean;
  leftText: string;
  rightText: string;
}

interface CompareResponse {
  studentA: string;
  studentB: string;
  overallSimilarity: number;
  alignedBlocks: CompareBlock[];
}

interface StudentSubmissionOption {
  id: string;
  name: string;
  fileName: string;
}

interface AssignmentOption {
  id: string;
  title: string;
  students: StudentSubmissionOption[];
}

const mockAssignments: AssignmentOption[] = [
  {
    id: "a1",
    title: "Assignment 1 - Java Basics",
    students: [
      { id: "s1", name: "John Smith", fileName: "john_assignment1.java" },
      { id: "s2", name: "Emma Brown", fileName: "emma_assignment1.java" },
      { id: "s3", name: "Liam Wilson", fileName: "liam_assignment1.java" },
    ],
  },
  {
    id: "a2",
    title: "Assignment 2 - Data Structures",
    students: [
      { id: "s4", name: "Olivia Taylor", fileName: "olivia_assignment2.java" },
      { id: "s5", name: "Noah Martin", fileName: "noah_assignment2.java" },
    ],
  },
];

const mockCompareResponse: CompareResponse = {
  studentA: "john_assignment1.java",
  studentB: "emma_assignment1.java",
  overallSimilarity: 93,
  alignedBlocks: [
    {
      id: "block-1",
      leftStartLine: 1,
      leftEndLine: 4,
      rightStartLine: 18,
      rightEndLine: 21,
      similarity: 0.97,
      matched: true,
      leftText: `function calculateTotal(items) {
  let total = 0;
  for (const item of items) total += item.price;
  return total;
}`,
      rightText: `function calculateTotal(items) {
  let total = 0;
  for (const item of items) total += item.price;
  return total;
}`,
    },
    {
      id: "block-2",
      leftStartLine: 6,
      leftEndLine: 10,
      rightStartLine: 1,
      rightEndLine: 5,
      similarity: 0.91,
      matched: true,
      leftText: `function applyDiscount(total, rate) {
  if (rate > 0) {
    return total - total * rate;
  }
  return total;
}`,
      rightText: `function applyDiscount(total, rate) {
  if (rate > 0) {
    return total - total * rate;
  }
  return total;
}`,
    },
    {
      id: "block-3",
      leftStartLine: 12,
      leftEndLine: 15,
      rightStartLine: 7,
      rightEndLine: 10,
      similarity: 0.28,
      matched: false,
      leftText: `console.log("Student A custom footer");
const finalValue = total + 5;
return finalValue;`,
      rightText: `console.log("Student B helper section");
const finalTotal = total;
return finalTotal;`,
    },
  ],
};

function normalizeCode(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeLine(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function blockMatchesTemplate(blockText: string, templateText: string) {
  if (!templateText.trim()) return false;
  const normalizedBlock = normalizeCode(blockText);
  const normalizedTemplate = normalizeCode(templateText);

  return (
    normalizedTemplate.includes(normalizedBlock) ||
    normalizedBlock.includes(normalizedTemplate)
  );
}

function buildLines(text: string, startLine: number) {
  return text.split("\n").map((line, index) => ({
    number: startLine + index,
    content: line,
    normalized: normalizeLine(line),
  }));
}

function getMatchedLineSet(sourceText: string, otherText: string) {
  const sourceLines = sourceText.split("\n");
  const otherNormalizedSet = new Set(
    otherText
      .split("\n")
      .map((line) => normalizeLine(line))
      .filter((line) => line.length > 0)
  );

  return new Set(
    sourceLines
      .map((line, index) => ({
        index,
        normalized: normalizeLine(line),
      }))
      .filter((line) => line.normalized.length > 0 && otherNormalizedSet.has(line.normalized))
      .map((line) => indexToLineNumber(line.index))
  );
}

function indexToLineNumber(index: number) {
  return index;
}

function CodePanel({
  title,
  text,
  otherText,
  startLine,
  matched,
  similarity,
  highlightLines,
}: {
  title: string;
  text: string;
  otherText: string;
  startLine: number;
  matched: boolean;
  similarity: number;
  highlightLines: boolean;
}) {
  const lines = buildLines(text, startLine);

  const matchedLineIndexes = React.useMemo(() => {
    if (!highlightLines) return new Set<number>();

    const otherNormalizedSet = new Set(
      otherText
        .split("\n")
        .map((line) => normalizeLine(line))
        .filter((line) => line.length > 0)
    );

    return new Set(
      lines
        .filter(
          (line) =>
            line.normalized.length > 0 && otherNormalizedSet.has(line.normalized)
        )
        .map((line) => line.number)
    );
  }, [lines, otherText, highlightLines]);

  return (
    <div className="overflow-hidden rounded-2xl border bg-background">
      <div
        className={`flex items-center justify-between border-b px-4 py-3 ${
          matched ? "bg-primary/10" : "bg-muted/40"
        }`}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
        </div>
        <div className="ml-4 text-xs text-muted-foreground">
          Match: {Math.round(similarity * 100)}%
        </div>
      </div>

      <div
        className={`font-mono text-sm ${
          matched ? "bg-primary/5" : "bg-background"
        }`}
      >
        {lines.map((line) => {
          const isMatchedLine = matchedLineIndexes.has(line.number);

          return (
            <div
              key={`${title}-${line.number}`}
              className={`grid grid-cols-[64px_1fr] border-b last:border-b-0 ${
                isMatchedLine ? "bg-yellow-100/80 dark:bg-yellow-900/30" : ""
              }`}
            >
              <div
                className={`select-none border-r px-3 py-2 text-right text-xs text-muted-foreground ${
                  isMatchedLine ? "bg-yellow-200/70 dark:bg-yellow-800/30" : "bg-muted/40"
                }`}
              >
                {line.number}
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap px-3 py-2">
                {line.content}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ComparePage() {
  const searchParams = useSearchParams();

  const [loading, setLoading] = React.useState(false);
  const [autoAlign, setAutoAlign] = React.useState(true);
  const [highlightMatches, setHighlightMatches] = React.useState(true);
  const [highlightSimilarLines, setHighlightSimilarLines] = React.useState(true);
  const [excludeTemplate, setExcludeTemplate] = React.useState(false);
  const [templateCode, setTemplateCode] = React.useState(`function calculateTotal(items) {
  let total = 0;
  for (const item of items) total += item.price;
  return total;
}`);

  const [assignmentId, setAssignmentId] = React.useState("");
  const [studentAId, setStudentAId] = React.useState("");
  const [studentBId, setStudentBId] = React.useState("");
  const [formError, setFormError] = React.useState("");
  const [result, setResult] = React.useState<CompareResponse | null>(null);

  const selectedAssignment = React.useMemo(
    () => mockAssignments.find((assignment) => assignment.id === assignmentId) ?? null,
    [assignmentId]
  );

  const availableStudents = selectedAssignment?.students ?? [];

  React.useEffect(() => {
    const assignmentFromUrl = searchParams.get("assignmentId");
    const studentAFromUrl = searchParams.get("studentA");
    const studentBFromUrl = searchParams.get("studentB");

    if (assignmentFromUrl) setAssignmentId(assignmentFromUrl);
    if (studentAFromUrl) setStudentAId(studentAFromUrl);
    if (studentBFromUrl) setStudentBId(studentBFromUrl);
  }, [searchParams]);

  React.useEffect(() => {
    setStudentAId((current) => {
      if (!current) return current;
      return availableStudents.some((student) => student.id === current) ? current : "";
    });

    setStudentBId((current) => {
      if (!current) return current;
      return availableStudents.some((student) => student.id === current) ? current : "";
    });

    setResult(null);
    setFormError("");
  }, [assignmentId, availableStudents]);

  const displayedBlocks = React.useMemo(() => {
    if (!result) return [];

    let blocks = [...result.alignedBlocks].filter((block) => {
      if (!excludeTemplate) return true;

      const isTemplateMatch =
        blockMatchesTemplate(block.leftText, templateCode) ||
        blockMatchesTemplate(block.rightText, templateCode);

      return !isTemplateMatch;
    });

    if (autoAlign) {
      return blocks.sort((a, b) => {
        if (a.matched && !b.matched) return -1;
        if (!a.matched && b.matched) return 1;
        return b.similarity - a.similarity;
      });
    }

    return blocks.sort((a, b) => a.leftStartLine - b.leftStartLine);
  }, [result, autoAlign, excludeTemplate, templateCode]);

  const adjustedSimilarity = React.useMemo(() => {
    if (!result) return 0;
    if (!excludeTemplate) return result.overallSimilarity;
    if (displayedBlocks.length === 0) return 0;

    const avg =
      displayedBlocks.reduce((sum, block) => sum + block.similarity, 0) /
      displayedBlocks.length;

    return Math.round(avg * 100);
  }, [result, excludeTemplate, displayedBlocks]);

  const handleCompare = async () => {
    setFormError("");

    if (!assignmentId) {
      setFormError("Please select an assignment.");
      return;
    }

    if (!studentAId || !studentBId) {
      setFormError("Please select two student submissions.");
      return;
    }

    if (studentAId === studentBId) {
      setFormError("Please select two different students for comparison.");
      return;
    }

    setLoading(true);

    try {
      const studentA = availableStudents.find((student) => student.id === studentAId);
      const studentB = availableStudents.find((student) => student.id === studentBId);

      // Replace later with real backend call
      // const data = await apiFetch<CompareResponse>("/api/instructor/compare", {
      //   method: "POST",
      //   body: JSON.stringify({
      //     assignmentId,
      //     submissionAId: studentAId,
      //     submissionBId: studentBId,
      //     autoAlign,
      //     excludeTemplate,
      //     templateCode,
      //   }),
      // });
      // setResult(data);

      await new Promise((resolve) => setTimeout(resolve, 700));

      setResult({
        ...mockCompareResponse,
        studentA: studentA?.fileName ?? "studentA.java",
        studentB: studentB?.fileName ?? "studentB.java",
      });
    } catch (error) {
      console.error("Comparison failed:", error);
      setFormError("Failed to compare submissions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Compare Submissions</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Select an assignment, choose two student submissions, and compare them
          side by side with block highlighting, line highlighting, auto-alignment,
          and optional template exclusion.
        </p>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            Comparison Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="assignment">Assignment</Label>
              <select
                id="assignment"
                value={assignmentId}
                onChange={(e) => setAssignmentId(e.target.value)}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none"
              >
                <option value="">Select assignment</option>
                {mockAssignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignment.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="studentA">Student A</Label>
              <select
                id="studentA"
                value={studentAId}
                onChange={(e) => setStudentAId(e.target.value)}
                disabled={!selectedAssignment}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select student</option>
                {availableStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} - {student.fileName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="studentB">Student B</Label>
              <select
                id="studentB"
                value={studentBId}
                onChange={(e) => setStudentBId(e.target.value)}
                disabled={!selectedAssignment}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select student</option>
                {availableStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} - {student.fileName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center space-x-2">
              <Switch checked={autoAlign} onCheckedChange={setAutoAlign} />
              <Label>Auto Align Similar Blocks</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={highlightMatches}
                onCheckedChange={setHighlightMatches}
              />
              <Label>Highlight Matched Blocks</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={highlightSimilarLines}
                onCheckedChange={setHighlightSimilarLines}
              />
              <Label>Highlight Similar Lines</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={excludeTemplate}
                onCheckedChange={setExcludeTemplate}
              />
              <Label>Exclude Template Code</Label>
            </div>
          </div>

          {excludeTemplate && (
            <div className="space-y-2">
              <Label htmlFor="templateCode">Template / Boilerplate Code</Label>
              <textarea
                id="templateCode"
                value={templateCode}
                onChange={(e) => setTemplateCode(e.target.value)}
                placeholder="Paste the instructor-provided template code here..."
                className="min-h-[180px] w-full rounded-xl border bg-background px-4 py-3 font-mono text-sm outline-none"
              />
              <p className="text-xs text-muted-foreground">
                Matching template code will be excluded from the comparison.
              </p>
            </div>
          )}

          {formError ? (
            <p className="text-sm font-medium text-destructive">{formError}</p>
          ) : null}

          <Button onClick={handleCompare} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Comparing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Start Comparison
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="flex items-center gap-3 p-6">
                <ArrowLeftRight className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Compared Files</p>
                  <p className="font-semibold">2 submissions</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardContent className="flex items-center gap-3 p-6">
                <Percent className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {excludeTemplate ? "Similarity After Exclusion" : "Overall Similarity"}
                  </p>
                  <p className="font-semibold">{adjustedSimilarity}%</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardContent className="flex items-center gap-3 p-6">
                <Code2 className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Visible Blocks</p>
                  <p className="font-semibold">{displayedBlocks.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Comparison Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Assignment: </span>
                <span className="font-medium">
                  {selectedAssignment?.title ?? "Not selected"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Left submission: </span>
                <span className="font-medium">{result.studentA}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Right submission: </span>
                <span className="font-medium">{result.studentB}</span>
              </div>
              <div>
                <span className="text-muted-foreground">View mode: </span>
                <span className="font-medium">
                  {autoAlign ? "Auto-aligned matched blocks" : "Original left-file order"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Template exclusion: </span>
                <span className="font-medium">
                  {excludeTemplate ? "Enabled" : "Disabled"}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {displayedBlocks.map((block) => {
              const shouldHighlightBlock = highlightMatches ? block.matched : false;

              return (
                <div key={block.id} className="grid gap-6 lg:grid-cols-2">
                  <CodePanel
                    title={`Left File (Lines ${block.leftStartLine}-${block.leftEndLine})`}
                    text={block.leftText}
                    otherText={block.rightText}
                    startLine={block.leftStartLine}
                    matched={shouldHighlightBlock}
                    similarity={block.similarity}
                    highlightLines={highlightSimilarLines}
                  />
                  <CodePanel
                    title={`Right File (Lines ${block.rightStartLine}-${block.rightEndLine})`}
                    text={block.rightText}
                    otherText={block.leftText}
                    startLine={block.rightStartLine}
                    matched={shouldHighlightBlock}
                    similarity={block.similarity}
                    highlightLines={highlightSimilarLines}
                  />
                </div>
              );
            })}

            {displayedBlocks.length === 0 && (
              <Card className="rounded-2xl shadow-sm">
                <CardContent className="p-6 text-sm text-muted-foreground">
                  No comparison blocks remain after applying the current filters.
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}