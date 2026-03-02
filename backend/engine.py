import os
import zipfile
import tempfile
import shutil
import hashlib
import json
import itertools

from tree_sitter import Language, Parser
import tree_sitter_java
import tree_sitter_cpp

# Tuned smaller for debugging with small test files
K_GRAM_SIZE = 5
WINDOW_SIZE = 4
REPORT_LIMIT = 0.0
SIMILARITY_THRESHOLD = 0.15  # Only pairs above this similarity will be reported

# Mapping rules for Lexical tokens
LEXICAL_MAP = {
    "identifier": "ID", "field_identifier": "ID", "type_identifier": "ID", "variable_declarator": "ID",
    "decimal_integer_literal": "NUM", "hex_integer_literal": "NUM", "number_literal": "NUM",
    "string_literal": "STR", "character_literal": "STR", "true": "BOOL", "false": "BOOL",
}

# Mapping rules for Structural tokens
STRUCTURAL_MAP = {
    "if_statement": "IF", "else_clause": "ELSE", "for_statement": "LOOP_START", "while_statement": "LOOP_START",
    "do_statement": "LOOP_START", "enhanced_for_statement": "LOOP_START", "return_statement": "RETURN",
    "program": "MODULE", "method_declaration": "FUNC_DEF", "function_definition": "FUNC_DEF",
    "constructor_declaration": "FUNC_DEF", "class_declaration": "CLASS", "assignment_expression": "ASSIGN",
    "update_expression": "PLUS_ASSIGN", "binary_expression": "BIN_OP",
}

# Node types to ignore during parsing
IGNORE_NODE_TYPES = {
    "comment", "line_comment", "block_comment", "block", "compound_statement",
    "expression_statement", "parenthesized_expression", "formal_parameters",
    "argument_list", "declaration", "translation_unit"
}

# Initialize languages
JAVA_LANG = Language(tree_sitter_java.language())
CPP_LANG = Language(tree_sitter_cpp.language())


def get_parser(extension):
    # Returns the correct parser based on file extension
    parser = Parser()
    try:
        if extension == ".java":
            parser.language = JAVA_LANG
            return parser
        elif extension in [".cpp", ".c", ".cc", ".h", ".hpp"]:
            parser.language = CPP_LANG
            return parser
    except Exception:
        return None
    return None


def normalize_ast(node, tokens):
    # Recursively walks the tree to extract tokens
    if node.type in IGNORE_NODE_TYPES:
        for child in node.children:
            normalize_ast(child, tokens)
        return

    token_str = None
    if node.type in LEXICAL_MAP:
        token_str = LEXICAL_MAP[node.type]
    elif node.type in STRUCTURAL_MAP:
        token_str = STRUCTURAL_MAP[node.type]

    if token_str:
        # Add 1 because tree sitter starts at line 0
        line_num = node.start_point[0] + 1
        tokens.append({"t": token_str, "line": line_num})

    for child in node.children:
        normalize_ast(child, tokens)


def normalize_package(directory_path, student_id):
    # Reads all files in a folder and merges them into one token stream
    all_tokens = []
    valid_exts = {".java", ".cpp", ".cc", ".c", ".h", ".hpp"}

    files = []
    for root, _, filenames in os.walk(directory_path):
        for filename in filenames:
            # Ignores ALL hidden files (starting with .) and macOS specific junk
            if filename.startswith("._") or "__MACOSX" in root:
                continue

            ext = os.path.splitext(filename)[1]
            if ext in valid_exts:
                full_path = os.path.join(root, filename)
                files.append((full_path, ext))

    # Sort files to ensure the order is always the same
    files.sort()

    for path, ext in files:
        parser = get_parser(ext)
        if not parser: continue

        try:
            with open(path, "rb") as f:
                code = f.read()
            tree = parser.parse(code)
            file_tokens = []
            normalize_ast(tree.root_node, file_tokens)

            # Save relative path for the report
            rel_path = os.path.relpath(path, directory_path)
            for tok in file_tokens:
                tok["file"] = rel_path
                tok["student"] = student_id
                all_tokens.append(tok)
        except Exception as e:
            print(f"Error parsing {path}: {e}")

    return all_tokens


def kgrams(tokens, k=K_GRAM_SIZE):
    # Generates overlapping k-grams from the token list
    grams = []
    for i in range(len(tokens) - k + 1):
        window = tokens[i: i + k]

        # Check if window crosses file boundaries and skip if true
        if window[0]["file"] != window[-1]["file"]:
            continue

        # Use space delimiter to avoid accidental token boundary collisions
        content_str = " ".join([t["t"] for t in window])
        meta = {
            "hash": None,
            "file": window[0]["file"],
            "start": window[0]["line"],
            "end": window[-1]["line"]
        }
        grams.append((content_str, meta))
    return grams


def hash_kgrams(kgrams_list):
    # Converts k-gram strings into numeric hashes
    hashed_list = []
    for content_str, meta in kgrams_list:
        h_val = int(hashlib.md5(content_str.encode("utf-8")).hexdigest(), 16)
        meta["hash"] = h_val
        hashed_list.append(meta)
    return hashed_list


def winnow(hashed_grams, w=WINDOW_SIZE):
    # Selects the minimum hash in every window to reduce data size
    if len(hashed_grams) == 0: return []
    fingerprints = []
    last_min_idx = -1
    for i in range(len(hashed_grams) - w + 1):
        window = hashed_grams[i: i + w]
        min_obj = min(window, key=lambda x: x["hash"])
        min_idx_rel = window.index(min_obj)
        min_idx_abs = i + min_idx_rel

        # Only add if it is a new index
        if min_idx_abs != last_min_idx:
            fingerprints.append(min_obj)
            last_min_idx = min_idx_abs
    return fingerprints


def process_zip_submission(zip_path, extract_root):
    # Unzips a file and runs the processing pipeline
    student_id = os.path.splitext(os.path.basename(zip_path))[0]
    extract_path = os.path.join(extract_root, student_id)
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_path)
        tokens = normalize_package(extract_path, student_id)
        grams = kgrams(tokens)
        hashes = hash_kgrams(grams)
        fps = winnow(hashes)
        return student_id, fps
    except zipfile.BadZipFile:
        return student_id, []


def compare_fingerprints(fp_a, fp_b):
    # Compares two sets of fingerprints to find matches
    map_a = {}
    for fp in fp_a:
        h = fp["hash"]
        if h not in map_a: map_a[h] = []
        map_a[h].append(fp)

    matches = []
    unique_hashes = set()

    for fb in fp_b:
        h = fb["hash"]
        if h in map_a:
            unique_hashes.add(h)
            for fa in map_a[h]:
                matches.append({
                    "hash": str(h),
                    "file_a": fa["file"], "start_a": fa["start"], "end_a": fa["end"],
                    "file_b": fb["file"], "start_b": fb["start"], "end_b": fb["end"]
                })

    set_a = set(f["hash"] for f in fp_a)
    set_b = set(f["hash"] for f in fp_b)
    intersection = len(set_a.intersection(set_b))
    union = len(set_a.union(set_b))
    score = intersection / union if union > 0 else 0.0
    return score, matches


# --- Helper functions ---
def group_and_merge_matches(matches, min_block_size=3):
    """
    Groups matches by file pair and merges overlapping line ranges.
    Returns compact region-level matches.
    """
    grouped = {}

    for m in matches:
        key = (m["file_a"], m["file_b"])
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(m)

    merged_blocks = []

    for (file_a, file_b), items in grouped.items():
        # Sort by start lines
        items.sort(key=lambda x: (x["start_a"], x["start_b"]))

        current = None

        for m in items:
            if current is None:
                current = {
                    "file_a": file_a,
                    "file_b": file_b,
                    "start_a": m["start_a"],
                    "end_a": m["end_a"],
                    "start_b": m["start_b"],
                    "end_b": m["end_b"],
                    "hash_count": 1
                }
                continue

            # Merge only if both A and B sides are roughly aligned
            a_adjacent = m["start_a"] <= current["end_a"] + 1
            b_adjacent = m["start_b"] <= current["end_b"] + 1

            # Ensure structural alignment between A and B
            a_offset = m["start_a"] - current["end_a"]
            b_offset = m["start_b"] - current["end_b"]

            aligned = abs(a_offset - b_offset) <= 2  # tolerance of 2 lines

            if a_adjacent and b_adjacent and aligned:
                current["end_a"] = max(current["end_a"], m["end_a"])
                current["end_b"] = max(current["end_b"], m["end_b"])
                current["hash_count"] += 1
            else:
                if (current["end_a"] - current["start_a"] + 1) >= min_block_size:
                    merged_blocks.append(current)
                current = {
                    "file_a": file_a,
                    "file_b": file_b,
                    "start_a": m["start_a"],
                    "end_a": m["end_a"],
                    "start_b": m["start_b"],
                    "end_b": m["end_b"],
                    "hash_count": 1
                }

        if current and (current["end_a"] - current["start_a"] + 1) >= min_block_size:
            merged_blocks.append(current)

    return merged_blocks


# --- Full pair object ---
def build_pair_object(s1, s2, score, raw_matches, submissions_folder):
    """
    Builds a fully structured pair object with:
    - block_id
    - density & confidence
    - highlight ranges per file
    - summary statistics
    """

    merged_blocks = group_and_merge_matches(raw_matches)

    structured_blocks = []
    highlight_map = {
        s1: {},
        s2: {}
    }

    total_lines_a = 0
    total_lines_b = 0
    high_conf_blocks = 0
    density_sum = 0

    for idx, block in enumerate(merged_blocks, start=1):
        block_length = block["end_a"] - block["start_a"] + 1
        density = block["hash_count"] / block_length if block_length > 0 else 0

        confidence = "LOW"
        if density >= 0.75:
            confidence = "HIGH"
            high_conf_blocks += 1
        elif density >= 0.6:
            confidence = "MEDIUM"

        density_sum += density
        total_lines_a += block_length
        total_lines_b += (block["end_b"] - block["start_b"] + 1)

        structured_block = {
            "block_id": idx,
            "file_a": block["file_a"],
            "file_b": block["file_b"],
            "start_a": block["start_a"],
            "end_a": block["end_a"],
            "start_b": block["start_b"],
            "end_b": block["end_b"],
            "block_length": block_length,
            "density": round(density, 3),
            "confidence": confidence
        }

        structured_blocks.append(structured_block)

        # Build highlight map
        highlight_map[s1].setdefault(block["file_a"], []).append({
            "block_id": idx,
            "start": block["start_a"],
            "end": block["end_a"]
        })

        highlight_map[s2].setdefault(block["file_b"], []).append({
            "block_id": idx,
            "start": block["start_b"],
            "end": block["end_b"]
        })

    avg_density = (density_sum / len(structured_blocks)) if structured_blocks else 0

    severity_score = (
            (score * 0.5) +
            (avg_density * 0.3) +
            ((high_conf_blocks / len(structured_blocks)) * 0.2 if structured_blocks else 0)
    )

    # Embed sources
    sources = {
        s1: {},
        s2: {}
    }

    for student in highlight_map:
        for file_name in highlight_map[student]:
            sources[student][file_name] = fetch_source_code(
                submissions_folder,
                student,
                file_name
            )

    return {
        "pair_id": f"{s1}_{s2}",
        "student_1": s1,
        "student_2": s2,
        "similarity": round(score, 4),
        "severity_score": round(severity_score, 4),

        "summary": {
            "total_blocks": len(structured_blocks),
            "high_confidence_blocks": high_conf_blocks,
            "total_suspicious_lines_a": total_lines_a,
            "total_suspicious_lines_b": total_lines_b,
            "average_density": round(avg_density, 3)
        },

        "blocks": structured_blocks,
        "files": highlight_map,
        "sources": sources
    }


def fetch_source_code(submissions_folder, student_id, internal_path):
    # Reads the full source code from the zip file for the report
    zip_path = os.path.join(submissions_folder, f"{student_id}.zip")
    try:
        with zipfile.ZipFile(zip_path, "r") as z:
            target = internal_path.replace("\\", "/")
            if target in z.namelist():
                return z.read(target).decode("utf-8", errors="ignore")
            # Try to find the file if path separators differ
            for f in z.namelist():
                if f.endswith(target):
                    return z.read(f).decode("utf-8", errors="ignore")
    except Exception:
        return "// Error reading file"
    return "// File not found"


# --_Boilerplate Handling ---
def load_boilerplate_hashes(template_dir):
    """
    Processes the professor's template code and returns a SET of hashes
    that should be ignored.
    """
    if not os.path.exists(template_dir) or not os.listdir(template_dir):
        print("No template files found. Skipping boilerplate detection.")
        return set()

    print(f"Loading Boilerplate from: {template_dir}")
    # Normalize the template just like a student submission
    tokens = normalize_package(template_dir, "TEMPLATE")
    grams = kgrams(tokens)
    hashes = hash_kgrams(grams)
    fps = winnow(hashes)

    # Return just the hash values as a set for fast lookup
    ignored_hashes = {fp["hash"] for fp in fps}
    print(f"Loaded {len(ignored_hashes)} boilerplate fingerprints.")
    return ignored_hashes


def run_engine(submissions_folder, template_folder):
    # Main execution function
    temp_dir = tempfile.mkdtemp()
    print(f"Processing submissions in {submissions_folder}")

    # 1. Load Boilerplate (Professor's Code)
    ignored_hashes = load_boilerplate_hashes(template_folder)

    fingerprint_db = {}
    zip_files = [f for f in os.listdir(submissions_folder) if f.endswith(".zip")]
    print("Zip files found:", zip_files)

    # Step 1 Generate fingerprints for all students
    for zf in zip_files:
        full_path = os.path.join(submissions_folder, zf)
        s_id, fps = process_zip_submission(full_path, temp_dir)

        if fps:
            # --- FILTERING STEP ---
            # Remove any fingerprint that matches the professor's code
            filtered_fps = [fp for fp in fps if fp["hash"] not in ignored_hashes]
            fingerprint_db[s_id] = filtered_fps

            removed_count = len(fps) - len(filtered_fps)
            print(f"{s_id} -> fingerprints generated: {len(filtered_fps)} (Removed {removed_count} boilerplate)")
        else:
            print(f"{s_id} -> fingerprints generated: 0")
            fingerprint_db[s_id] = []

    flagged_pairs = []
    forensic_results = []

    student_ids = list(fingerprint_db.keys())
    total_students = len(student_ids)
    total_pairs_possible = (total_students * (total_students - 1)) // 2

    print("Students ready for comparison:", student_ids)

    # Step 2 Compare every student against every other student
    for s1, s2 in itertools.combinations(student_ids, 2):
        score, matches = compare_fingerprints(fingerprint_db[s1], fingerprint_db[s2])
        print(f"Comparing {s1} vs {s2} -> score:", score)

        if score >= SIMILARITY_THRESHOLD:
            print(f"Match found {s1} vs {s2} with score {score:.2f}")

            # Clean frontend structure
            clean_pair = build_pair_object(s1, s2, score, matches, submissions_folder)

            flagged_pairs.append(clean_pair)

            # Full forensic data (raw matches preserved)
            forensic_results.append({
                "student_1": s1,
                "student_2": s2,
                "similarity": round(score, 4),
                "raw_match_count": len(matches),
                "raw_matches": matches
            })

    # Also generate forensic report separately
    forensic_path = os.path.join(os.path.dirname(__file__), "forensic_report.json")
    with open(forensic_path, "w") as f:
        json.dump(forensic_results, f, indent=2)

    # Sort flagged pairs by severity score (highest suspicion first)
    flagged_pairs.sort(key=lambda x: x["severity_score"], reverse=True)

    final_output = {
        "metadata": {
            "total_students": total_students,
            "total_pairs_possible": total_pairs_possible,
            "pairs_flagged": len(flagged_pairs),
            "similarity_threshold": SIMILARITY_THRESHOLD
        },
        "pairs": flagged_pairs
    }

    shutil.rmtree(temp_dir)
    print("Processing complete")

    return json.dumps(final_output, indent=2)


if __name__ == "__main__":
    BASE_DIR = os.path.dirname(__file__)
    SUBMISSION_DIR = os.path.join(BASE_DIR, "submissions")
    TEMPLATE_DIR = os.path.join(BASE_DIR, "template")  # Put professor's code here (not zipped)

    # Auto-create the template folder if it doesn't exist so you can drop files into it later
    os.makedirs(TEMPLATE_DIR, exist_ok=True)

    if os.path.exists(SUBMISSION_DIR) and os.listdir(SUBMISSION_DIR):
        # Pass both folders to the engine
        json_output = run_engine(SUBMISSION_DIR, TEMPLATE_DIR)

        with open("class_report.json", "w") as f:
            f.write(json_output)
        print("Saved to class_report.json")
    else:
        print("Please add zip files to the submissions folder")
