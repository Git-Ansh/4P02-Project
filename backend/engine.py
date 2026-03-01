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

# Configuration settings
K_GRAM_SIZE = 12
WINDOW_SIZE = 10
REPORT_LIMIT = 0.0

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

        content_str = "".join([t["t"] for t in window])
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


def run_engine(submissions_folder):
    # Main execution function
    temp_dir = tempfile.mkdtemp()
    print(f"Processing submissions in {submissions_folder}")

    fingerprint_db = {}
    zip_files = [f for f in os.listdir(submissions_folder) if f.endswith(".zip")]

    # Step 1 Generate fingerprints for all students
    for zf in zip_files:
        full_path = os.path.join(submissions_folder, zf)
        s_id, fps = process_zip_submission(full_path, temp_dir)
        if fps: fingerprint_db[s_id] = fps

    results = []
    student_ids = list(fingerprint_db.keys())

    # Step 2 Compare every student against every other student
    for s1, s2 in itertools.combinations(student_ids, 2):
        score, matches = compare_fingerprints(fingerprint_db[s1], fingerprint_db[s2])

        if score > REPORT_LIMIT:
            print(f"Match found {s1} vs {s2} with score {score:.2f}")

            # Step 3 Extract full source code for the UI
            code_lookup = {}

            files_needed_a = set(m['file_a'] for m in matches)
            files_needed_b = set(m['file_b'] for m in matches)

            for f in files_needed_a:
                code_lookup[f"{s1}::{f}"] = fetch_source_code(submissions_folder, s1, f)

            for f in files_needed_b:
                code_lookup[f"{s2}::{f}"] = fetch_source_code(submissions_folder, s2, f)

            results.append({
                "student_1": s1,
                "student_2": s2,
                "similarity": round(score, 4),
                "match_count": len(matches),
                "matches": matches,
                "files": code_lookup
            })

    shutil.rmtree(temp_dir)
    print("Processing complete")
    return json.dumps(results, indent=2)


if __name__ == "__main__":
    SUBMISSION_DIR = os.path.join(os.path.dirname(__file__), "submissions")
    if os.path.exists(SUBMISSION_DIR) and os.listdir(SUBMISSION_DIR):
        json_output = run_engine(SUBMISSION_DIR)
        with open("class_report.json", "w") as f:
            f.write(json_output)
        print("Saved to class_report.json")
    else:
        print("Please add zip files to the submissions folder")