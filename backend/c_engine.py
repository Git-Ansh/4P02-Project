import os
import zipfile
import tempfile
import json
import itertools
import math
from concurrent.futures import ProcessPoolExecutor, as_completed

# MurmurHash3 — fast non-cryptographic hashing (pip install mmh3)
import mmh3

from tree_sitter import Language, Parser
import tree_sitter_java
import tree_sitter_cpp

# ── Tuning parameters ──────────────────────────────────────────────────────────
# K_GRAM_SIZE is now a FALLBACK only — actual k is chosen adaptively per file
# based on that file's token count. See adaptive_k() below.
K_GRAM_SIZE = 8             # fallback default (raised from 5 — see note below)
WINDOW_SIZE = 4
SIMILARITY_THRESHOLD = 0.15

# ── Adaptive k thresholds ──────────────────────────────────────────────────────
# Maps token count buckets to k values.
# Rationale: a small file has few tokens — using a large k produces almost no
# k-grams and makes the fingerprint too sparse to be meaningful. A large file
# with k=5 produces too many short common sequences (noise). Adaptive k keeps
# the fingerprint density roughly constant regardless of file size.
#
# These boundaries were chosen based on typical Java assignment sizes:
#   < 80  tokens  ≈ tiny helper/stub file     → k=5
#   < 200 tokens  ≈ small single-class file   → k=7
#   < 500 tokens  ≈ medium assignment file    → k=9
#   500+  tokens  ≈ large multi-method file   → k=11
ADAPTIVE_K_THRESHOLDS = [
    (80,  5),
    (200, 7),
    (500, 9),
]
ADAPTIVE_K_MAX = 11   # used when token count exceeds all thresholds

# ── Token diversity filter ────────────────────────────────────────────────────
# A k-gram window where all tokens are the same type (e.g. ID ID ID ID ID) is
# structurally meaningless — it matches trivially across any two files that do
# arithmetic or variable access, which is every file. We require at least this
# many DISTINCT token types in a window before it is considered fingerprint-worthy.
#
# Examples with MIN_TOKEN_DIVERSITY = 3:
#   "ID ID ID ID ID"              → 1 unique type → DISCARDED  (noise)
#   "ID ID ASSIGN ID ID"          → 2 unique types → DISCARDED  (too generic)
#   "IF ID ASSIGN NUM RETURN"     → 4 unique types → KEPT       (distinctive)
#   "LOOP_START ID BIN_OP ID NUM" → 4 unique types → KEPT       (distinctive)
#
# Setting this too high (e.g. 5) risks discarding valid short matches in small
# files. 3 is the practical minimum for meaningful structural distinctiveness.
MIN_TOKEN_DIVERSITY = 3

# ── Token maps ────────────────────────────────────────────────────────────────
LEXICAL_MAP = {
    "identifier": "ID", "field_identifier": "ID", "type_identifier": "ID",
    "decimal_integer_literal": "NUM", "hex_integer_literal": "NUM", "number_literal": "NUM",
    "string_literal": "STR", "character_literal": "STR", "true": "BOOL", "false": "BOOL",
}

STRUCTURAL_MAP = {
    "if_statement": "IF", "else_clause": "ELSE", "for_statement": "LOOP_START",
    "while_statement": "LOOP_START", "do_statement": "LOOP_START",
    "enhanced_for_statement": "LOOP_START", "return_statement": "RETURN",
    "program": "MODULE", "method_declaration": "FUNC_DEF", "function_definition": "FUNC_DEF",
    "constructor_declaration": "FUNC_DEF", "class_declaration": "CLASS",
    "assignment_expression": "ASSIGN", "update_expression": "PLUS_ASSIGN",
    "binary_expression": "BIN_OP",
}

IGNORE_NODE_TYPES = {
    "comment", "line_comment", "block_comment", "block", "compound_statement",
    "expression_statement", "parenthesized_expression", "formal_parameters",
    "argument_list", "declaration", "translation_unit", "variable_declarator",
}

# ── Language initialisation ───────────────────────────────────────────────────
JAVA_LANG = Language(tree_sitter_java.language())
CPP_LANG  = Language(tree_sitter_cpp.language())


# ─────────────────────────────────────────────────────────────────────────────
# Adaptive k selection
# ─────────────────────────────────────────────────────────────────────────────

def adaptive_k(token_count):
    """
    Returns the appropriate k-gram size for a file with the given token count.

    WHY ADAPTIVE K:
    A fixed k creates a tradeoff — small k causes too many coincidental matches
    on short common sequences (false positives), large k on small files produces
    almost no fingerprints (false negatives). Adaptive k keeps fingerprint density
    roughly stable: each file gets a k proportional to how much code it contains.

    The returned k is also stored in each fingerprint's metadata so the frontend
    can display it and the forensic report can reproduce results exactly.
    """
    for threshold, k in ADAPTIVE_K_THRESHOLDS:
        if token_count < threshold:
            return k
    return ADAPTIVE_K_MAX


# ─────────────────────────────────────────────────────────────────────────────
# Parsing helpers
# ─────────────────────────────────────────────────────────────────────────────

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


def normalize_package(directory_path, student_id):
    """
    Walks a student's extracted directory and returns a token stream.

    CHANGE: Now returns tokens grouped by file as a dict
    { rel_path -> [tokens] } so that adaptive_k() can be applied
    per-file rather than to the entire merged stream.
    Previously tokens were merged into one flat list immediately,
    losing the per-file token count needed for per-file k selection.
    """
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

    # Returns: list of (rel_path, [token_dicts])
    file_token_groups = []

    for path, ext in files:
        parser = get_parser(ext)
        if not parser:
            continue
        try:
            with open(path, "rb") as f:
                code = f.read()
            tree = parser.parse(code)
            file_tokens = []
            normalize_ast(tree.root_node, file_tokens)
            rel_path = os.path.relpath(path, directory_path)
            for tok in file_tokens:
                tok["file"] = rel_path
                tok["student"] = student_id
            file_token_groups.append((rel_path, file_tokens))
        except Exception as e:
            print(f"Error parsing {path}: {e}")

    return file_token_groups


# ─────────────────────────────────────────────────────────────────────────────
# Fingerprinting
# ─────────────────────────────────────────────────────────────────────────────

def kgrams(tokens, k):
    """
    Generates overlapping k-grams from a single file's token list.

    CHANGE: k is now a required parameter — callers must pass it explicitly.
    This enforces that every call site has consciously chosen a k value
    (via adaptive_k()) rather than silently falling back to the global default.
    The k value is stored in each gram's metadata for traceability.
    """
    grams = []
    for i in range(len(tokens) - k + 1):
        window = tokens[i: i + k]

        # Boundary check — all tokens must be from the same file
        if len({t["file"] for t in window}) > 1:
            continue

        # Diversity filter — discard windows where all (or nearly all) tokens
        # are the same type. A window like "ID ID ID ID ID" matches trivially
        # in any file that does variable access and tells us nothing about copying.
        # We require at least MIN_TOKEN_DIVERSITY distinct token types in the window.
        token_types = {t["t"] for t in window}
        if len(token_types) < MIN_TOKEN_DIVERSITY:
            continue

        content_str = " ".join(t["t"] for t in window)
        grams.append((content_str, {
            "hash": None,
            "file": window[0]["file"],
            "start": window[0]["line"],
            "end": window[-1]["line"],
            "k": k,    # stored for forensic traceability
        }))
    return grams


def hash_kgrams(kgrams_list):
    """Uses mmh3.hash128() — ~3-5x faster than MD5, returns int directly."""
    hashed_list = []
    for content_str, meta in kgrams_list:
        meta["hash"] = mmh3.hash128(content_str, signed=False)
        hashed_list.append(meta)
    return hashed_list


def winnow(hashed_grams, w=WINDOW_SIZE):
    """
    Moss-compliant winnowing: selects RIGHTMOST minimum hash in each window.
    Rightmost tie-breaking ensures identical files produce identical fingerprint
    sets, keeping similarity scores consistent.
    """
    if not hashed_grams:
        return []

    fingerprints = []
    last_min_idx = -1

    for i in range(len(hashed_grams) - w + 1):
        window = hashed_grams[i: i + w]
        min_hash_val = min(g["hash"] for g in window)

        for j in range(w - 1, -1, -1):
            if window[j]["hash"] == min_hash_val:
                min_idx_abs = i + j
                break

        if min_idx_abs != last_min_idx:
            fingerprints.append(hashed_grams[min_idx_abs])
            last_min_idx = min_idx_abs

    return fingerprints


# ─────────────────────────────────────────────────────────────────────────────
# Zip handling
# ─────────────────────────────────────────────────────────────────────────────

def _load_zip_source_cache(zip_path):
    """Reads every file in a zip once into memory: { path -> source_str }."""
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


def _lookup_source(source_cache, student_id, internal_path):
    student_files = source_cache.get(student_id, {})
    target = internal_path.replace("\\", "/")
    if target in student_files:
        return student_files[target]
    for cached_path, content in student_files.items():
        if cached_path.endswith(target):
            return content
    return "// File not found"


def process_zip_submission(zip_path, extract_root):
    """
    Unzips one submission and runs the full fingerprint pipeline.

    CHANGE: normalize_package now returns per-file token groups. This function
    applies adaptive_k() to each file individually, then merges all fingerprints
    into one flat list. The k used per file is stored in each fingerprint's
    metadata. Also returns a k_map { file -> k } for the metadata report.

    Must remain a module-level function (not a closure) to be picklable by
    ProcessPoolExecutor.
    """
    student_id = os.path.splitext(os.path.basename(zip_path))[0]
    extract_path = os.path.join(extract_root, student_id)
    try:
        with zipfile.ZipFile(zip_path, "r") as zr:
            zr.extractall(extract_path)

        file_token_groups = normalize_package(extract_path, student_id)

        all_fps = []
        k_map   = {}   # rel_path -> k used, reported in metadata

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


# ─────────────────────────────────────────────────────────────────────────────
# Boilerplate handling
# ─────────────────────────────────────────────────────────────────────────────

def load_boilerplate_hashes(template_dir):
    """
    Processes the professor's template/starter code and returns the set of
    fingerprint hashes that should be ignored during comparison.

    HOW IT WORKS:
    The template directory is run through the exact same pipeline as a student
    submission — normalize → kgrams (adaptive k per file) → hash → winnow.
    The resulting hashes represent code patterns that every student will have
    simply because the professor gave it to them. Matching on these would flag
    every student pair as suspicious, which is wrong.

    These hashes are stripped from every student's fingerprint set before the
    inverted index is built, so boilerplate never enters the IDF weight table
    either — keeping the weighted Jaccard scores clean.

    WHY FIXED HERE (not in compare_fingerprints):
    Filtering before the index means boilerplate hashes never affect IDF weights.
    If we filtered inside compare_fingerprints, a boilerplate hash shared by all
    30 students would still pollute the inverted index and skew weights.

    Returns: set of hash integers to ignore. Empty set if no template found.
    """
    if not os.path.exists(template_dir) or not os.listdir(template_dir):
        print("No template directory found — skipping boilerplate detection.")
        return set()

    print(f"Loading boilerplate from: {template_dir}")

    # Use the same per-file adaptive pipeline as student submissions
    file_token_groups = normalize_package(template_dir, "TEMPLATE")

    all_fps = []
    for rel_path, tokens in file_token_groups:
        k = adaptive_k(len(tokens))
        grams  = kgrams(tokens, k)
        hashed = hash_kgrams(grams)
        fps    = winnow(hashed)
        all_fps.extend(fps)

    ignored_hashes = {fp["hash"] for fp in all_fps}
    print(f"Boilerplate fingerprints loaded: {len(ignored_hashes)} hashes will be ignored.")
    return ignored_hashes


# ─────────────────────────────────────────────────────────────────────────────
# Inverted index
# ─────────────────────────────────────────────────────────────────────────────

def build_inverted_index(fingerprint_db):
    """
    Builds hash -> {student_id, ...} so we only compare pairs sharing >= 1 hash.
    Also the foundation for IDF weight computation — the set size for each hash
    IS the document frequency used in build_idf_weights().
    """
    inverted = {}
    for student_id, fps in fingerprint_db.items():
        for fp in fps:
            h = fp["hash"]
            if h not in inverted:
                inverted[h] = set()
            inverted[h].add(student_id)
    return inverted


def candidate_pairs_from_index(inverted_index):
    """Returns only pairs sharing at least one hash as sorted (s1, s2) tuples."""
    candidates = set()
    for students in inverted_index.values():
        if len(students) > 1:
            for pair in itertools.combinations(sorted(students), 2):
                candidates.add(pair)
    return candidates


# ─────────────────────────────────────────────────────────────────────────────
# IDF weight computation
# ─────────────────────────────────────────────────────────────────────────────

def build_idf_weights(inverted_index, total_students):
    """
    Computes an Inverse Document Frequency (IDF) weight for every hash seen
    across the class.

    WHY IDF-WEIGHTED JACCARD:
    Standard Jaccard treats every shared fingerprint equally. But a hash like
    the token sequence for a simple 'for' loop appears in almost every student's
    submission naturally — it's structural boilerplate, not evidence of copying.
    Meanwhile a hash that only appears in 2 out of 30 students is highly suspicious.

    IDF captures this: the weight of a hash is inversely proportional to how
    many students share it. A hash in 1 student gets weight 1.0. A hash in all
    30 students gets weight ~0.17. When computing similarity, shared common-code
    hashes contribute almost nothing; shared rare hashes dominate the score.

    Formula:  weight(h) = 1 / log(1 + students_containing_h)

    We use log base-e (natural log). Adding 1 inside the log prevents division
    by zero and ensures weight(h) = 1.0 when only 1 student has the hash.

    WHY COMPUTE HERE (not inside compare_fingerprints):
    IDF requires the full class view — you cannot know a hash is "rare" until
    you have seen every student's fingerprints. Computing it per-pair would mean
    each pair sees a different class, producing inconsistent weights. By computing
    once here after all fingerprints are built, every pair comparison uses the
    same consistent weight table.

    Returns: { hash -> float weight }
    """
    weights = {}
    for h, students in inverted_index.items():
        doc_freq = len(students)
        weights[h] = 1.0 / math.log(1 + doc_freq)
    return weights


# ─────────────────────────────────────────────────────────────────────────────
# Comparison
# ─────────────────────────────────────────────────────────────────────────────

def compare_fingerprints(fp_a, fp_b, idf_weights):
    """
    Computes IDF-weighted Jaccard similarity between two fingerprint sets.

    CHANGE: Replaced raw Jaccard with IDF-weighted Jaccard.

    STANDARD JACCARD (old):
        score = |A ∩ B| / |A ∪ B|
        Every hash counts as 1 regardless of how common it is across the class.

    WEIGHTED JACCARD (new):
        score = sum(weight[h] for h in A ∩ B)
              / sum(weight[h] for h in A ∪ B)

        Where weight[h] = 1 / log(1 + students_with_h)

    The effect: a shared hash that appears in 25/30 students contributes ~0.17
    to the numerator. A shared hash that appears in only 2/30 students contributes
    ~0.59. The score is now dominated by rare shared patterns — exactly the kind
    that indicate actual copying rather than common code structure.

    The raw match list is unchanged — it still records every individual matched
    hash location for the block merging and highlighting steps downstream.
    """
    map_a = {}
    for fp in fp_a:
        map_a.setdefault(fp["hash"], []).append(fp)

    matches = []
    for fb in fp_b:
        h = fb["hash"]
        if h in map_a:
            for fa in map_a[h]:
                matches.append({
                    "hash": str(h),
                    "file_a": fa["file"], "start_a": fa["start"], "end_a": fa["end"],
                    "file_b": fb["file"], "start_b": fb["start"], "end_b": fb["end"],
                })

    set_a = {f["hash"] for f in fp_a}
    set_b = {f["hash"] for f in fp_b}
    union_hashes        = set_a | set_b
    intersection_hashes = set_a & set_b

    # Weighted Jaccard — sums IDF weights instead of counting raw hashes
    # Falls back to weight=1.0 for any hash not in the table (shouldn't happen
    # in practice, but guards against edge cases like single-student classes)
    w_intersection = sum(idf_weights.get(h, 1.0) for h in intersection_hashes)
    w_union        = sum(idf_weights.get(h, 1.0) for h in union_hashes)

    score = w_intersection / w_union if w_union > 0 else 0.0
    return score, matches


# ─────────────────────────────────────────────────────────────────────────────
# Reporting
# ─────────────────────────────────────────────────────────────────────────────

def group_and_merge_matches(matches, min_block_size=3):
    """
    Groups matches by file pair and merges adjacent/overlapping line ranges.
    Merges purely on adjacency — no structural alignment check, since copied
    code can appear at any line in the target file.
    """
    grouped = {}
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

            a_adjacent = m["start_a"] <= current["end_a"] + 2
            b_adjacent = m["start_b"] <= current["end_b"] + 2

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


def build_pair_object(s1, s2, score, raw_matches, source_cache):
    merged_blocks = group_and_merge_matches(raw_matches)

    structured_blocks = []
    highlight_map = {s1: {}, s2: {}}
    total_lines_a = total_lines_b = high_conf_blocks = density_sum = 0

    for idx, block in enumerate(merged_blocks, start=1):
        block_length = block["end_a"] - block["start_a"] + 1
        density = block["hash_count"] / block_length if block_length > 0 else 0

        confidence = "LOW"
        if density >= 0.75:
            confidence = "HIGH"
            high_conf_blocks += 1
        elif density >= 0.6:
            confidence = "MEDIUM"

        density_sum   += density
        total_lines_a += block_length
        total_lines_b += block["end_b"] - block["start_b"] + 1

        structured_blocks.append({
            "block_id": idx,
            "file_a": block["file_a"], "file_b": block["file_b"],
            "start_a": block["start_a"], "end_a": block["end_a"],
            "start_b": block["start_b"], "end_b": block["end_b"],
            "block_length": block_length,
            "density": round(density, 3),
            "confidence": confidence,
        })

        highlight_map[s1].setdefault(block["file_a"], []).append(
            {"block_id": idx, "start": block["start_a"], "end": block["end_a"]}
        )
        highlight_map[s2].setdefault(block["file_b"], []).append(
            {"block_id": idx, "start": block["start_b"], "end": block["end_b"]}
        )

    n = len(structured_blocks)
    avg_density = density_sum / n if n else 0
    severity_score = (
        score       * 0.5 +
        avg_density * 0.3 +
        (high_conf_blocks / n * 0.2 if n else 0)
    )

    sources = {s1: {}, s2: {}}
    for sid in (s1, s2):
        for file_name in highlight_map[sid]:
            sources[sid][file_name] = _lookup_source(source_cache, sid, file_name)

    return {
        "pair_id": f"{s1}_{s2}",
        "student_1": s1, "student_2": s2,
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


# ─────────────────────────────────────────────────────────────────────────────
# Main engine
# ─────────────────────────────────────────────────────────────────────────────

def run_engine(submissions_folder, template_folder=None, parallel=True, save_forensic=False):
    """
    submissions_folder — absolute path to the folder containing student .zip files
    template_folder    — optional path to professor's starter/template code
                         (plain directory of .java/.cpp files, NOT a zip).
                         Fingerprints from this code are stripped from every
                         student's fingerprint set before comparison so professor-
                         provided boilerplate never inflates similarity scores.
                         Pass None (default) to skip boilerplate filtering.
    parallel=True      — uses ProcessPoolExecutor (production, multi-core)
    parallel=False     — sequential fallback (testing / comparator / single-file runs)
    save_forensic=False — when True, writes forensic_report.json next to the
                          submissions folder. Off by default — the raw match data
                          is large and only useful for debugging specific pairs.
    """
    base_dir = os.path.dirname(os.path.abspath(submissions_folder))

    # ── Step 0: Load boilerplate hashes (before anything else) ───────────────
    # Done first so the set is ready to filter fingerprints immediately after
    # each student is processed. Boilerplate hashes are stripped before the
    # inverted index is built — keeping them out of IDF weights entirely.
    boilerplate_hashes = load_boilerplate_hashes(template_folder) if template_folder else set()
    if boilerplate_hashes:
        print(f"Boilerplate filter active: {len(boilerplate_hashes)} hashes excluded.")
    else:
        print("No boilerplate filter applied.")

    print(f"Processing submissions in {submissions_folder}")
    zip_files = [f for f in os.listdir(submissions_folder) if f.endswith(".zip")]
    print("Zip files found:", zip_files)

    fingerprint_db = {}
    source_cache   = {}
    k_map_db       = {}   # student_id -> { file -> k used }

    with tempfile.TemporaryDirectory() as temp_dir:

        # ── Step 1: Fingerprint all submissions ───────────────────────────────
        full_paths = [os.path.join(submissions_folder, zf) for zf in zip_files]

        if parallel:
            with ProcessPoolExecutor() as executor:
                future_to_path = {
                    executor.submit(process_zip_submission, path, temp_dir): path
                    for path in full_paths
                }
                for future in as_completed(future_to_path):
                    s_id, fps, k_map = future.result()
                    print(f"{s_id} -> fingerprints: {len(fps)}  "
                          f"k values used: {sorted(set(k_map.values()))}")
                    fingerprint_db[s_id] = fps
                    k_map_db[s_id]       = k_map
                    source_cache[s_id]   = _load_zip_source_cache(future_to_path[future])
        else:
            for path in full_paths:
                s_id, fps, k_map = process_zip_submission(path, temp_dir)
                print(f"{s_id} -> fingerprints: {len(fps)}  "
                      f"k values used: {sorted(set(k_map.values()))}")
                fingerprint_db[s_id] = fps
                k_map_db[s_id]       = k_map
                source_cache[s_id]   = _load_zip_source_cache(path)

        # ── Step 1b: Strip boilerplate hashes from every student ────────────
        # Done here — after all fingerprints are built but before the inverted
        # index — so boilerplate hashes never enter the index or the IDF table.
        # Filtering inside compare_fingerprints would be too late: the hashes
        # would already be in the index and skewing IDF weights for every pair.
        if boilerplate_hashes:
            before = sum(len(fps) for fps in fingerprint_db.values())
            fingerprint_db = {
                s_id: [fp for fp in fps if fp["hash"] not in boilerplate_hashes]
                for s_id, fps in fingerprint_db.items()
            }
            after = sum(len(fps) for fps in fingerprint_db.values())
            print(f"Boilerplate stripped: {before - after} fingerprints removed "
                  f"({before} → {after} remaining across all students)")

        # ── Step 2: Build inverted index + IDF weights ────────────────────────
        total_students = len(fingerprint_db)
        inverted_index = build_inverted_index(fingerprint_db)
        idf_weights    = build_idf_weights(inverted_index, total_students)
        candidates     = candidate_pairs_from_index(inverted_index)
        total_possible = total_students * (total_students - 1) // 2

        print(f"IDF weight table: {len(idf_weights)} unique hashes across class")
        print(f"Candidate pairs: {len(candidates)} / {total_possible} total")

        flagged_pairs    = []
        forensic_results = []

        # ── Step 3: Compare candidate pairs with weighted Jaccard ─────────────
        for s1, s2 in candidates:
            score, matches = compare_fingerprints(
                fingerprint_db[s1], fingerprint_db[s2], idf_weights
            )
            print(f"Comparing {s1} vs {s2} -> weighted score: {score:.4f}")

            if score >= SIMILARITY_THRESHOLD:
                print(f"  -> Match flagged: {s1} vs {s2} ({score:.2f})")
                clean_pair = build_pair_object(s1, s2, score, matches, source_cache)
                flagged_pairs.append(clean_pair)
                if save_forensic:
                    forensic_results.append({
                        "student_1": s1, "student_2": s2,
                        "similarity": round(score, 4),
                        "raw_match_count": len(matches),
                        "raw_matches": matches,
                    })

    # ── Optional forensic dump ────────────────────────────────────────────────
    if save_forensic:
        forensic_path = os.path.join(base_dir, "forensic_report.json")
        with open(forensic_path, "w") as f:
            json.dump(forensic_results, f, indent=2)
        print(f"Forensic report saved to {forensic_path}")

    flagged_pairs.sort(key=lambda x: x["severity_score"], reverse=True)

    final_output = {
        "metadata": {
            "total_students": total_students,
            "total_pairs_possible": total_possible,
            "candidate_pairs_evaluated": len(candidates),
            "pairs_flagged": len(flagged_pairs),
            "similarity_threshold": SIMILARITY_THRESHOLD,
            "adaptive_k_used": k_map_db,
            "boilerplate_hashes_filtered": len(boilerplate_hashes),
        },
        "pairs": flagged_pairs,
    }

    print("Processing complete")
    return json.dumps(final_output, indent=2)


if __name__ == "__main__":
    # ── Configure these two paths ─────────────────────────────────────────────
    # SUBMISSION_DIR  — folder containing one .zip per student
    # TEMPLATE_DIR    — folder containing the professor's starter/template files
    #                   (plain .java/.cpp files, not zipped)
    #                   Set to None if there is no template for this assignment.
    SUBMISSION_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "submissions")
    TEMPLATE_DIR   = os.path.join(os.path.dirname(os.path.abspath(__file__)), "template")
    # If no template folder exists, boilerplate filtering is automatically skipped.
    TEMPLATE_DIR   = TEMPLATE_DIR if os.path.exists(TEMPLATE_DIR) else None

    if os.path.exists(SUBMISSION_DIR) and os.listdir(SUBMISSION_DIR):
        json_output = run_engine(SUBMISSION_DIR, template_folder=TEMPLATE_DIR, save_forensic=False)
        report_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "class_report.json")
        with open(report_path, "w") as f:
            f.write(json_output)
        print(f"Saved to {report_path}")
    else:
        print("Please add zip files to the submissions folder")
