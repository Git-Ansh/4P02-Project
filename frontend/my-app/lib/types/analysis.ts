export interface AnalysisMetadata {
  total_students: number;
  total_pairs_possible: number;
  candidate_pairs_evaluated: number;
  pairs_flagged: number;
  similarity_threshold: number;
  boilerplate_hashes_filtered: number;
}

export interface MatchBlock {
  block_id: number;
  file_a: string;
  file_b: string;
  start_a: number;
  end_a: number;
  start_b: number;
  end_b: number;
  block_length: number;
  block_length_a?: number;
  block_length_b?: number;
  density: number;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "FILE";
}

export interface PairSummary {
  total_blocks: number;
  high_confidence_blocks: number;
  total_suspicious_lines_a: number;
  total_suspicious_lines_b: number;
  average_density: number;
}

export interface AnalysisPair {
  pair_id: string;
  student_1: string;
  student_2: string;
  similarity: number;
  severity_score: number;
  summary: PairSummary;
  blocks: MatchBlock[];
  files: Record<string, Record<string, { block_id: number; start: number; end: number }[]>>;
  sources: Record<string, Record<string, string>>;
}

export interface AnalysisReport {
  id: string;
  status: "running" | "completed" | "failed";
  started_at: string;
  completed_at: string | null;
  error?: string | null;
  metadata: AnalysisMetadata | null;
  pairs: AnalysisPair[] | null;
}

export interface RecentAnalysis {
  id: string;
  assignment_id: string;
  course_id: string;
  assignment_title: string;
  course_code: string;
  status: string;
  pairs_flagged: number;
  top_severity: number;
  completed_at: string | null;
  started_at: string;
  submission_count?: number;
}

export interface FlaggedPair {
  pair_id: string;
  assignment_id: string;
  course_id: string;
  assignment_title: string;
  course_code: string;
  student_1: string;
  student_2: string;
  similarity: number;
  severity_score: number;
}

export interface AssignmentSubmissionCount {
  assignment_id: string;
  course_id: string;
  course_code: string;
  title: string;
  count: number;
}

export interface InstructorDashboardData {
  course_count: number;
  total_assignments: number;
  total_submissions: number;
  submissions_by_assignment: AssignmentSubmissionCount[];
  flagged_high_count: number;
  flagged_med_count: number;
  flagged_low_count: number;
  recent_analyses: RecentAnalysis[];
  flagged_pairs: FlaggedPair[];
}

export interface ReferenceSubmission {
  id: string;
  filename: string;
  student_count: number;
  uploaded_at: string;
}
