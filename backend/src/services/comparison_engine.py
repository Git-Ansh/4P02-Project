"""
Comparison engine for plagiarism detection.

Uses tree-sitter for AST-based tokenization, adaptive k-gram hashing (MurmurHash3),
IDF-weighted Winnowing for fingerprint selection, and weighted Jaccard similarity.
"""

import itertools
import math
import os
import shutil
import tempfile
import zipfile

import mmh3
from tree_sitter import Language, Parser
import tree_sitter_java
import tree_sitter_cpp

from src.utils.zip_utils import resolve_nested_zips

# ── Tuning parameters ────────────────────────────────────────────────────────

K_GRAM_SIZE = 5          # fallback default (adaptive_k overrides per-file)
WINDOW_SIZE = 4
SIMILARITY_THRESHOLD = 0.15

# Adaptive k thresholds — maps token count buckets to k values
ADAPTIVE_K_THRESHOLDS = [
    (80,  5),    # tiny helper/stub files
    (200, 7),    # small single-class files
    (500, 9),    # medium assignment files
]
ADAPTIVE_K_MAX = 11      # large multi-method files

# Token diversity — minimum distinct token types in a k-gram window
MIN_TOKEN_DIVERSITY = 3

# ── Token maps ────────────────────────────────────────────────────────────────

LEXICAL_MAP = {
    "identifier": "ID", "field_identifier": "ID", "type_identifier": "ID",
    "variable_declarator": "ID",
    "decimal_integer_literal": "NUM", "hex_integer_literal": "NUM",
    "number_literal": "NUM",
    "string_literal": "STR", "character_literal": "STR",
    "true": "BOOL", "false": "BOOL",
}

STRUCTURAL_MAP = {
    "if_statement": "IF", "else_clause": "ELSE",
    "for_statement": "LOOP_START", "while_statement": "LOOP_START",
    "do_statement": "LOOP_START", "enhanced_for_statement": "LOOP_START",
    "return_statement": "RETURN",
    "program": "MODULE", "method_declaration": "FUNC_DEF",
    "function_definition": "FUNC_DEF",
    "constructor_declaration": "FUNC_DEF", "class_declaration": "CLASS",
    "assignment_expression": "ASSIGN", "update_expression": "PLUS_ASSIGN",
    "binary_expression": "BIN_OP",
}

IGNORE_NODE_TYPES = {
    "comment", "line_comment", "block_comment", "block",
    "compound_statement", "expression_statement",
    "parenthesized_expression", "formal_parameters",
    "argument_list", "declaration", "translation_unit",
}

JAVA_LANG = Language(tree_sitter_java.language())
CPP_LANG = Language(tree_sitter_cpp.language())


# ── Adaptive k selection ──────────────────────────────────────────────────────


def adaptive_k(token_count):
    """Return appropriate k-gram size for a file with *token_count* tokens."""
    for threshold, k in ADAPTIVE_K_THRESHOLDS:
        if token_count < threshold:
            return k
    return ADAPTIVE_K_MAX


# ── Parsing helpers ───────────────────────────────────────────────────────────


def get_parser(extension):
    parser = Parser()
    try:
        if extension == ".java":
            parser.language = JAVA_LANG
            return parser
        elif extension in {".cpp", ".c", ".cc", ".h", ".hpp"}:
            parser.language = CPP_LANG
            return parser
    except Exception:
        return None
    return None


def normalize_ast(node, tokens):
    if node.type in IGNORE_NODE_TYPES:
        for child in node.children:
            normalize_ast(child, tokens)
        return

    token_str = LEXICAL_MAP.get(node.type) or STRUCTURAL_MAP.get(node.type)
    if token_str:
        tokens.append({"t": token_str, "line": node.start_point[0] + 1})

    for child in node.children:
        normalize_ast(child, tokens)


def _clean_rel_path(rel_path: str) -> str:
    """Normalize a relative path to use forward slashes and strip a single
    leading wrapper directory (e.g. ``student_02_submission/MathUtils.java``
    becomes ``MathUtils.java``).  Keeps deeper nesting intact."""
    p = rel_path.replace("\\", "/")
    parts = p.split("/")
    # If the first component is a single wrapper dir, remove it
    if len(parts) > 1:
        parts = parts[1:]
    return "/".join(parts)


def normalize_package(directory_path, student_id):
    """Return per-file token groups: ``[(clean_path, [token_dicts])]``."""
    valid_exts = {".java", ".cpp", ".cc", ".c", ".h", ".hpp"}
    files = []

    for root, _, filenames in os.walk(directory_path):
        for filename in filenames:
            if filename.startswith("._") or "__MACOSX" in root:
                continue
            ext = os.path.splitext(filename)[1]
            if ext in valid_exts:
                files.append((os.path.join(root, filename), ext))

    files.sort()

    file_token_groups: list[tuple[str, list[dict]]] = []

    for path, ext in files:
        parser = get_parser(ext)
        if not parser:
            continue
        try:
            with open(path, "rb") as f:
                code = f.read()
            tree = parser.parse(code)
            file_tokens: list[dict] = []
            normalize_ast(tree.root_node, file_tokens)

            raw_rel = os.path.relpath(path, directory_path)
            clean = _clean_rel_path(raw_rel)
            for tok in file_tokens:
                tok["file"] = clean
                tok["student"] = student_id
            file_token_groups.append((clean, file_tokens))
        except Exception as e:
            print(f"Error parsing {path}: {e}")

    return file_token_groups


# ── Fingerprinting ────────────────────────────────────────────────────────────


def kgrams(tokens, k=K_GRAM_SIZE):
    """Generate overlapping k-grams with token diversity filtering."""
    min_diversity = MIN_TOKEN_DIVERSITY
    grams = []
    for i in range(len(tokens) - k + 1):
        window = tokens[i: i + k]

        # All tokens must be from the same file
        if len({t["file"] for t in window}) > 1:
            continue

        # Token diversity filter
        if len({t["t"] for t in window}) < min_diversity:
            continue

        content_str = " ".join(t["t"] for t in window)
        meta = {
            "hash": None,
            "file": window[0]["file"],
            "start": window[0]["line"],
            "end": window[-1]["line"],
            "k": k,
        }
        grams.append((content_str, meta))
    return grams


def hash_kgrams(kgrams_list):
    """Hash k-grams using MurmurHash3 (fast, non-cryptographic)."""
    hashed_list = []
    for content_str, meta in kgrams_list:
        meta["hash"] = mmh3.hash128(content_str, signed=False)
        hashed_list.append(meta)
    return hashed_list


def winnow(hashed_grams, w=WINDOW_SIZE):
    """Moss-compliant winnowing with rightmost minimum tie-breaking."""
    if not hashed_grams:
        return []

    fingerprints = []
    last_min_idx = -1

    for i in range(len(hashed_grams) - w + 1):
        window = hashed_grams[i: i + w]
        min_hash_val = min(g["hash"] for g in window)

        # Rightmost minimum for consistent tie-breaking
        min_idx_abs = i
        for j in range(w - 1, -1, -1):
            if window[j]["hash"] == min_hash_val:
                min_idx_abs = i + j
                break

        if min_idx_abs != last_min_idx:
            fingerprints.append(hashed_grams[min_idx_abs])
            last_min_idx = min_idx_abs

    return fingerprints


# ── Zip handling ──────────────────────────────────────────────────────────────


def _load_zip_source_cache(zip_path):
    """Read every file in a ZIP into memory: ``{path: source_str}``."""
    cache = {}
    try:
        with zipfile.ZipFile(zip_path, "r") as z:
            for name in z.namelist():
                try:
                    cache[name] = z.read(name).decode("utf-8", errors="ignore")
                except Exception:
                    cache[name] = "// Error reading file"
    except Exception:
        pass
    return cache


def process_zip_submission(zip_path, extract_root):
    """Unzip one submission, apply adaptive k per file, return fingerprints.

    Returns ``(student_id, fingerprints, k_map)`` where *k_map* maps
    ``rel_path → k`` used for that file.
    """
    student_id = os.path.splitext(os.path.basename(zip_path))[0]
    extract_path = os.path.join(extract_root, student_id)
    try:
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(extract_path)
        resolve_nested_zips(extract_path)

        file_token_groups = normalize_package(extract_path, student_id)

        all_fps: list[dict] = []
        k_map: dict[str, int] = {}

        for rel_path, tokens in file_token_groups:
            k = adaptive_k(len(tokens))
            k_map[rel_path] = k
            grams = kgrams(tokens, k)
            hashed = hash_kgrams(grams)
            fps = winnow(hashed)
            all_fps.extend(fps)

        return student_id, all_fps, k_map
    except zipfile.BadZipFile:
        return student_id, [], {}


# ── IDF weighting ─────────────────────────────────────────────────────────────


def build_inverted_index(fingerprint_db):
    """Build ``hash → {student_id, ...}`` mapping."""
    inverted: dict[int, set[str]] = {}
    for student_id, fps in fingerprint_db.items():
        for fp in fps:
            inverted.setdefault(fp["hash"], set()).add(student_id)
    return inverted


def build_idf_weights(inverted_index, total_students):
    """Compute IDF weight for each hash: ``1 / log(1 + doc_freq)``."""
    weights: dict[int, float] = {}
    for h, students in inverted_index.items():
        weights[h] = 1.0 / math.log(1 + len(students))
    return weights


# ── Comparison ────────────────────────────────────────────────────────────────


def _basename(path: str) -> str:
    """Extract filename without directory for same-logical-file matching."""
    return os.path.basename(path.replace("\\", "/"))


def compare_fingerprints(fp_a, fp_b, idf_weights=None):
    """Compute similarity between two fingerprint sets.

    Only records matches between files with the same basename (same-logical-file
    policy). Uses nearest-line matching: each B fingerprint pairs with the
    closest A fingerprint (by start line) sharing the same hash and basename.
    This prevents cross-product noise when the same k-gram pattern appears at
    multiple positions within a file (e.g. similar for-loops in different
    methods).

    When *idf_weights* is provided, uses IDF-weighted Jaccard.
    Otherwise falls back to raw Jaccard (backward compatible).
    """
    map_a: dict[int, list[dict]] = {}
    for fp in fp_a:
        map_a.setdefault(fp["hash"], []).append(fp)

    matches = []
    for fb in fp_b:
        h = fb["hash"]
        if h not in map_a:
            continue
        # Find the nearest A fingerprint with the same basename
        best_fa = None
        best_dist = float("inf")
        for fa in map_a[h]:
            if _basename(fa["file"]) != _basename(fb["file"]):
                continue
            dist = abs(fa["start"] - fb["start"])
            if dist < best_dist:
                best_dist = dist
                best_fa = fa
        if best_fa is not None:
            matches.append({
                "hash": str(h),
                "file_a": best_fa["file"], "start_a": best_fa["start"], "end_a": best_fa["end"],
                "file_b": fb["file"], "start_b": fb["start"], "end_b": fb["end"],
            })

    set_a = {f["hash"] for f in fp_a}
    set_b = {f["hash"] for f in fp_b}
    union_hashes = set_a | set_b
    intersection_hashes = set_a & set_b

    if idf_weights is not None:
        w_inter = sum(idf_weights.get(h, 1.0) for h in intersection_hashes)
        w_union = sum(idf_weights.get(h, 1.0) for h in union_hashes)
        score = w_inter / w_union if w_union > 0 else 0.0
    else:
        score = len(intersection_hashes) / len(union_hashes) if union_hashes else 0.0

    return score, matches


# ── Reporting ─────────────────────────────────────────────────────────────────


def group_and_merge_matches(matches, min_block_size=3):
    """Group matches by file pair and merge adjacent/overlapping line ranges.

    Uses a gap tolerance of 2 lines to bridge blank lines and closing braces
    that don't produce tokens.
    """
    GAP = 2  # allow up to 2-line gap between matched regions

    grouped: dict[tuple, list] = {}
    for m in matches:
        grouped.setdefault((m["file_a"], m["file_b"]), []).append(m)

    merged_blocks = []
    for (file_a, file_b), items in grouped.items():
        items.sort(key=lambda x: (x["start_a"], x["start_b"]))
        current = None
        for m in items:
            if current is None:
                current = {
                    "file_a": file_a, "file_b": file_b,
                    "start_a": m["start_a"], "end_a": m["end_a"],
                    "start_b": m["start_b"], "end_b": m["end_b"],
                    "hash_count": 1,
                }
                continue

            a_adjacent = m["start_a"] <= current["end_a"] + GAP
            b_adjacent = m["start_b"] <= current["end_b"] + GAP

            if a_adjacent and b_adjacent:
                current["end_a"] = max(current["end_a"], m["end_a"])
                current["end_b"] = max(current["end_b"], m["end_b"])
                current["hash_count"] += 1
            else:
                if (current["end_a"] - current["start_a"] + 1) >= min_block_size:
                    merged_blocks.append(current)
                current = {
                    "file_a": file_a, "file_b": file_b,
                    "start_a": m["start_a"], "end_a": m["end_a"],
                    "start_b": m["start_b"], "end_b": m["end_b"],
                    "hash_count": 1,
                }
        if current and (current["end_a"] - current["start_a"] + 1) >= min_block_size:
            merged_blocks.append(current)

    return merged_blocks


def fetch_source_code(submissions_folder, student_id, internal_path):
    zip_path = os.path.join(submissions_folder, f"{student_id}.zip")
    try:
        with zipfile.ZipFile(zip_path, "r") as z:
            target = internal_path.replace("\\", "/")
            if target in z.namelist():
                return z.read(target).decode("utf-8", errors="ignore")
            for f in z.namelist():
                if f.endswith(target):
                    return z.read(f).decode("utf-8", errors="ignore")
    except Exception:
        return "// Error reading file"
    return "// File not found"


def build_pair_object(s1, s2, score, raw_matches, submissions_folder):
    merged_blocks = group_and_merge_matches(raw_matches)

    structured_blocks = []
    highlight_map = {s1: {}, s2: {}}

    for idx, block in enumerate(merged_blocks, start=1):
        block_length = block["end_a"] - block["start_a"] + 1
        density = block["hash_count"] / block_length if block_length > 0 else 0

        confidence = "LOW"
        if density >= 0.75:
            confidence = "HIGH"
        elif density >= 0.6:
            confidence = "MEDIUM"

        structured_blocks.append({
            "block_id": idx,
            "file_a": block["file_a"],
            "file_b": block["file_b"],
            "start_a": block["start_a"],
            "end_a": block["end_a"],
            "start_b": block["start_b"],
            "end_b": block["end_b"],
            "block_length": block_length,
            "density": round(density, 3),
            "confidence": confidence,
        })

        highlight_map[s1].setdefault(block["file_a"], []).append({
            "block_id": idx,
            "start": block["start_a"],
            "end": block["end_a"],
        })
        highlight_map[s2].setdefault(block["file_b"], []).append({
            "block_id": idx,
            "start": block["start_b"],
            "end": block["end_b"],
        })

    # Fetch sources for files that have blocks
    sources = {s1: {}, s2: {}}
    for student in highlight_map:
        for file_name in highlight_map[student]:
            sources[student][file_name] = fetch_source_code(
                submissions_folder, student, file_name
            )

    # ── Exact-match upgrade ──────────────────────────────────────────────
    # If any file is byte-for-byte identical between the two students,
    # replace its partial blocks with one full-file "FILE" block so that
    # the entire file is highlighted.
    common_files = set(sources[s1].keys()) & set(sources[s2].keys())
    for file_name in common_files:
        src1 = sources[s1].get(file_name, "")
        src2 = sources[s2].get(file_name, "")
        if not src1 or not src2 or src1 != src2:
            continue

        line_count = len(src1.split("\n"))

        # Remove old partial blocks for this file
        old_ids = {
            sb["block_id"] for sb in structured_blocks
            if sb["file_a"] == file_name or sb["file_b"] == file_name
        }
        structured_blocks = [
            sb for sb in structured_blocks if sb["block_id"] not in old_ids
        ]

        # Add one full-file block
        new_id = max((sb["block_id"] for sb in structured_blocks), default=0) + 1
        structured_blocks.append({
            "block_id": new_id,
            "file_a": file_name,
            "file_b": file_name,
            "start_a": 1, "end_a": line_count,
            "start_b": 1, "end_b": line_count,
            "block_length": line_count,
            "density": 1.0,
            "confidence": "FILE",
        })

        highlight_map[s1][file_name] = [
            {"block_id": new_id, "start": 1, "end": line_count}
        ]
        highlight_map[s2][file_name] = [
            {"block_id": new_id, "start": 1, "end": line_count}
        ]

    # ── Compute summary stats from final blocks ──────────────────────────
    total_lines_a = 0
    total_lines_b = 0
    high_conf_blocks = 0
    density_sum = 0

    for sb in structured_blocks:
        density_sum += sb["density"]
        total_lines_a += sb["end_a"] - sb["start_a"] + 1
        total_lines_b += sb["end_b"] - sb["start_b"] + 1
        if sb["confidence"] in ("HIGH", "FILE"):
            high_conf_blocks += 1

    n = len(structured_blocks)
    avg_density = (density_sum / n) if n else 0

    severity_score = (
        (score * 0.5)
        + (avg_density * 0.3)
        + ((high_conf_blocks / n) * 0.2 if n else 0)
    )

    return {
        "pair_id": f"{s1}_{s2}",
        "student_1": s1,
        "student_2": s2,
        "similarity": round(score, 4),
        "severity_score": round(severity_score, 4),
        "summary": {
            "total_blocks": n,
            "high_confidence_blocks": high_conf_blocks,
            "total_suspicious_lines_a": total_lines_a,
            "total_suspicious_lines_b": total_lines_b,
            "average_density": round(avg_density, 3),
        },
        "blocks": structured_blocks,
        "files": highlight_map,
        "sources": sources,
    }


# ── Main engine ───────────────────────────────────────────────────────────────


def run_engine(submissions_folder, boilerplate_folder=None, similarity_threshold=0.15):
    """Run the plagiarism detection pipeline.

    Args:
        submissions_folder: path containing ``{student_id}.zip`` files
        boilerplate_folder: optional path with template files to filter
        similarity_threshold: minimum score to flag a pair (0.0–1.0)

    Returns:
        dict with ``metadata`` and ``pairs`` keys.
    """
    temp_dir = tempfile.mkdtemp()

    fingerprint_db: dict[str, list[dict]] = {}
    k_map_db: dict[str, dict[str, int]] = {}
    boilerplate_hashes: set[int] = set()

    # Step 0: Process boilerplate with adaptive k
    if boilerplate_folder and os.path.isdir(boilerplate_folder):
        file_token_groups = normalize_package(boilerplate_folder, "_template")
        for rel_path, tokens in file_token_groups:
            k = adaptive_k(len(tokens))
            grams = kgrams(tokens, k)
            hashed = hash_kgrams(grams)
            fps = winnow(hashed)
            boilerplate_hashes.update(fp["hash"] for fp in fps)

    # Step 1: Fingerprint all submissions
    zip_files = [f for f in os.listdir(submissions_folder) if f.endswith(".zip")]

    for zf in zip_files:
        full_path = os.path.join(submissions_folder, zf)
        s_id, fps, k_map = process_zip_submission(full_path, temp_dir)
        k_map_db[s_id] = k_map
        fingerprint_db[s_id] = fps

    # Step 1b: Strip boilerplate hashes before building the IDF index
    if boilerplate_hashes:
        fingerprint_db = {
            s_id: [fp for fp in fps if fp["hash"] not in boilerplate_hashes]
            for s_id, fps in fingerprint_db.items()
        }

    # Step 2: Separate real students from reference submissions
    all_ids = list(fingerprint_db.keys())
    real_ids = [s for s in all_ids if not s.startswith("_ref_")]
    ref_ids = [s for s in all_ids if s.startswith("_ref_")]

    # Step 3: Build IDF weights from the full class
    inverted_index = build_inverted_index(fingerprint_db)
    idf_weights = build_idf_weights(inverted_index, len(fingerprint_db))

    # Step 4: Determine pairs — real-vs-real + real-vs-ref (skip ref-vs-ref)
    pairs_to_check = list(itertools.combinations(real_ids, 2))
    for r in real_ids:
        for ref in ref_ids:
            pairs_to_check.append((r, ref))

    # Step 5: Compare pairs with IDF-weighted Jaccard
    flagged_pairs = []
    candidate_pairs_evaluated = 0

    for s1, s2 in pairs_to_check:
        candidate_pairs_evaluated += 1
        score, matches = compare_fingerprints(
            fingerprint_db[s1], fingerprint_db[s2], idf_weights
        )

        if score >= similarity_threshold:
            clean_pair = build_pair_object(s1, s2, score, matches, submissions_folder)
            flagged_pairs.append(clean_pair)

    flagged_pairs.sort(key=lambda x: x["severity_score"], reverse=True)

    shutil.rmtree(temp_dir, ignore_errors=True)

    return {
        "metadata": {
            "total_students": len(real_ids),
            "total_pairs_possible": len(pairs_to_check),
            "candidate_pairs_evaluated": candidate_pairs_evaluated,
            "pairs_flagged": len(flagged_pairs),
            "similarity_threshold": similarity_threshold,
            "boilerplate_hashes_filtered": len(boilerplate_hashes),
            "reference_submissions": len(ref_ids),
        },
        "pairs": flagged_pairs,
    }
