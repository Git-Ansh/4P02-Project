import os
import re
import zipfile
import tempfile
import json
import itertools
import math
from concurrent.futures import ProcessPoolExecutor, as_completed

from src.utils.zip_utils import resolve_nested_zips

try:
    import mmh3
    def stable_hash128(s):
        return mmh3.hash128(s, signed=False)
except Exception:
    import hashlib
    def stable_hash128(s):
        return int.from_bytes(hashlib.blake2b(s.encode("utf-8"), digest_size=16).digest(), "big")

from tree_sitter import Language, Parser
import tree_sitter_java
import tree_sitter_cpp


SIMILARITY_THRESHOLD = 0
UNIT_MATCH_THRESHOLD = 0.16
UNIT_MIN_HASHES = 1
FILE_SIMILARITY_THRESHOLD = 0.90

ADAPTIVE_K_THRESHOLDS = [
    (30, 3),
    (60, 4),
    (200, 5),
    (500, 7),
]
ADAPTIVE_K_MAX = 9

MIN_TOKEN_DIVERSITY = 3

LEXICAL_MAP = {
    # --- Java ---
    "identifier": "ID",
    "field_identifier": "ID",
    "type_identifier": "TYPE",
    "decimal_integer_literal": "NUM",
    "hex_integer_literal": "NUM",
    "number_literal": "NUM",          # C/C++
    "floating_point_literal": "NUM",
    "string_literal": "STR",
    "character_literal": "STR",       # Java char literal
    "char_literal": "STR",            # C/C++ char literal
    "true": "BOOL",
    "false": "BOOL",
    "null_literal": "NULL",           # Java null
    "null": "NULL",                   # C++ nullptr
    "primitive_type": "TYPE",         # C++ int, float, char, void, etc.
    "auto": "TYPE",                   # C++ auto
}

STRUCTURAL_MAP = {
    "return_statement": "RETURN",
    "method_declaration": "FUNC_DEF",       # Java
    "function_definition": "FUNC_DEF",      # C/C++
    "constructor_declaration": "FUNC_DEF",  # Java
    "assignment_expression": "ASSIGN",
    "binary_expression": "BIN_OP",
    "update_expression": "UPDATE",
    "variable_declarator": "VAR_DECL",      # Java
    "local_variable_declaration": "VAR_DECL",# Java
    "declaration": "VAR_DECL",              # C/C++
    "init_declarator": "VAR_DECL",          # C/C++ (int x = 0)
    "array_access": "INDEX",                # Java
    "subscript_expression": "INDEX",        # C/C++
    "method_invocation": "CALL",            # Java
    "call_expression": "CALL",              # C/C++
    "object_creation_expression": "NEW",    # Java (new Foo())
    "new_expression": "NEW",                # C++ (new int(42))
    "delete_expression": "DELETE",          # C++
    "conditional_expression": "TERNARY",    # C/C++ (a ? b : c)
    "unary_expression": "UNARY",            # C/C++ (-x, !x, *p, &x)
    "field_expression": "FIELD_ACCESS",     # C/C++ (obj.member, ptr->member)
    "throw_statement": "THROW",             # C/C++
    "break_statement": "BREAK",             # C/C++
    "lambda_expression": "LAMBDA",          # C++
}

IGNORE_NODE_TYPES = {
    # --- Shared / Java ---
    "comment",
    "line_comment",
    "block_comment",
    "block",
    "compound_statement",
    "expression_statement",
    "parenthesized_expression",
    "formal_parameters",
    "argument_list",
    "translation_unit",
    # --- C/C++ ---
    "condition_clause",
    "else_clause",
    "field_declaration_list",
    "field_declaration",
    "template_declaration",
    "preproc_include",
    "using_declaration",
    "parameter_list",
    "parameter_declaration",
    "placeholder_type_specifier",
    "subscript_argument_list",
    "access_specifier",
    "type_qualifier",
    "storage_class_specifier",
    "template_parameter_list",
    "template_argument_list",
    "type_descriptor",
    "type_parameter_declaration",
    "field_initializer_list",
    "field_initializer",
    "catch_clause",
    "try_statement",
    "reference_declarator",
    "pointer_declarator",
    "function_declarator",
    "abstract_function_declarator",
    "lambda_capture_specifier",
    "initializer_list",
    "system_lib_string",
    "string_content",
    "destructor_name",
    "operator_name",
    "template_type",
}

STRUCTURE_TYPES = {
    "method_declaration": "METHOD",         # Java
    "constructor_declaration": "METHOD",    # Java
    "function_definition": "METHOD",        # C/C++
    "for_statement": "LOOP",
    "enhanced_for_statement": "LOOP",       # Java
    "for_range_loop": "LOOP",              # C++ (for auto& x : v)
    "while_statement": "LOOP",
    "do_statement": "LOOP",
    "if_statement": "IF",
    "switch_expression": "SWITCH",          # Java
    "switch_statement": "SWITCH",           # C/C++
    "class_specifier": "CLASS",             # C++
    "struct_specifier": "CLASS",            # C++
}

UNIT_PRIORITY = {
    "LOOP": 1,
    "METHOD": 2,
    "IF": 3,
    "SWITCH": 4,
    "CLASS": 5,
}

JAVA_LANG = Language(tree_sitter_java.language())
CPP_LANG = Language(tree_sitter_cpp.language())


LOOP_TYPES = {
    "for_statement", "enhanced_for_statement", "while_statement", "do_statement",
    "for_range_loop",
}
METHOD_TYPES = {"method_declaration", "constructor_declaration", "function_definition"}
CLASS_TYPES = {"class_specifier", "struct_specifier"}
IF_TYPES = {"if_statement"}
SWITCH_TYPES = {"switch_expression", "switch_statement"}
BODY_FIELD_CANDIDATES = ("body", "consequence", "alternative")


def adaptive_k(token_count):
    for threshold, k in ADAPTIVE_K_THRESHOLDS:
        if token_count < threshold:
            return k
    return ADAPTIVE_K_MAX

def adaptive_window(token_count):
    if token_count < 30:
        return 2
    if token_count < 80:
        return 3
    if token_count < 200:
        return 4
    return 5

def _same_logical_file(path_a, path_b):
    return os.path.basename(path_a).lower() == os.path.basename(path_b).lower()


def _is_reportable_unit(unit_type):
    return unit_type in {"METHOD", "LOOP", "IF", "SWITCH"}


def get_parser(extension):
    parser = Parser()
    try:
        if extension == ".java":
            parser.language = JAVA_LANG
            return parser
        if extension in {".cpp", ".c", ".cc", ".h", ".hpp", ".cxx", ".hxx", ".C"}:
            parser.language = CPP_LANG
            return parser
    except Exception:
        return None
    return None


def _append_token(tokens, token_str, line):
    tokens.append({"t": token_str, "line": line})


def _iter_named_children(node):
    return [child for child in node.children if getattr(child, "is_named", False)]


def _get_body_children(node):
    body_children = []
    for field in BODY_FIELD_CANDIDATES:
        child = node.child_by_field_name(field)
        if child is not None:
            body_children.append(child)
    if body_children:
        return body_children

    named = _iter_named_children(node)
    if not named:
        return []

    if node.type in LOOP_TYPES:
        return [named[-1]]
    if node.type in METHOD_TYPES | CLASS_TYPES:
        return [named[-1]]
    if node.type in IF_TYPES:
        return named[-2:] if len(named) >= 2 else [named[-1]]
    if node.type in SWITCH_TYPES:
        return [named[-1]]
    return []


def _extract_unit_name(node):
    try:
        if node.type in METHOD_TYPES:
            name_child = node.child_by_field_name("name")
            if name_child is not None:
                return name_child.text.decode("utf-8", errors="ignore")

            decl = node.child_by_field_name("declarator")
            if decl is not None:
                if decl.type == "function_declarator":
                    inner = decl.child_by_field_name("declarator")
                    if inner is not None:
                        name_text = inner.text.decode("utf-8", errors="ignore")
                        if "::" in name_text:
                            name_text = name_text.rsplit("::", 1)[-1]
                        name_text = name_text.lstrip("~")
                        return name_text
                    for child in decl.children:
                        if child.type in {"identifier", "field_identifier"}:
                            return child.text.decode("utf-8", errors="ignore")
                if decl.type in {"identifier", "field_identifier"}:
                    return decl.text.decode("utf-8", errors="ignore")

            for child in node.children:
                if child.type in {"identifier", "field_identifier", "type_identifier"}:
                    return child.text.decode("utf-8", errors="ignore")
        return None
    except Exception:
        return None


def _safe_text(node):
    try:
        return node.text.decode("utf-8", errors="ignore")
    except Exception:
        return ""


def _emit_call_semantics(node, tokens):
    text = _safe_text(node).lower()
    line = node.start_point[0] + 1
    if "charat(" in text:
        _append_token(tokens, "CHAR_ACCESS", line)
    if ".append(" in text or ".push_back(" in text:
        _append_token(tokens, "ACCUM_APPEND", line)
    if ".equals(" in text:
        _append_token(tokens, "EQUALS_CALL", line)
    if ".replace(" in text:
        _append_token(tokens, "REPLACE_CALL", line)
    if ".tochararray(" in text:
        _append_token(tokens, "TO_CHAR_ARRAY", line)
    if ".tolowercase(" in text or "tolower(" in text:
        _append_token(tokens, "TO_LOWER", line)
    if ".touppercase(" in text or "toupper(" in text:
        _append_token(tokens, "TO_UPPER", line)
    if ".tostring(" in text or "to_string(" in text or "std::to_string(" in text:
        _append_token(tokens, "TO_STRING", line)
    if ".length(" in text or text.endswith("length"):
        _append_token(tokens, "LENGTH_ACCESS", line)
    if ".size()" in text:
        _append_token(tokens, "LENGTH_ACCESS", line)
    if ".find(" in text:
        _append_token(tokens, "FIND_CALL", line)
    if ".insert(" in text:
        _append_token(tokens, "INSERT_CALL", line)
    if ".erase(" in text:
        _append_token(tokens, "ERASE_CALL", line)
    if ".begin(" in text or ".end(" in text:
        _append_token(tokens, "ITER_ACCESS", line)
    if ".front(" in text or ".back(" in text:
        _append_token(tokens, "ENDPOINT_ACCESS", line)
    if ".empty(" in text:
        _append_token(tokens, "EMPTY_CHECK", line)
    if ".substr(" in text or ".substring(" in text:
        _append_token(tokens, "SUBSTR_CALL", line)
    if "sort(" in text:
        _append_token(tokens, "SORT_CALL", line)
    if "reverse(" in text:
        _append_token(tokens, "REVERSE_CALL", line)
    if "swap(" in text:
        _append_token(tokens, "SWAP_CALL", line)
    if "cout" in text or "printf(" in text or "println(" in text:
        _append_token(tokens, "PRINT_CALL", line)
    if "cin" in text or "scanf(" in text or "getline(" in text:
        _append_token(tokens, "INPUT_CALL", line)


def _emit_expr_semantics(node, tokens):
    text = _safe_text(node).lower()
    line = node.start_point[0] + 1
    node_type = node.type

    if node_type in {"assignment_expression"}:
        if "+=" in text:
            _append_token(tokens, "ACCUM_APPEND", line)
        elif "-=" in text:
            _append_token(tokens, "ACCUM_SUB", line)
    elif node_type in {"update_expression"}:
        if "--" in text:
            _append_token(tokens, "DECREMENT", line)
        elif "++" in text:
            _append_token(tokens, "INCREMENT", line)
    elif node_type in {"binary_expression"}:
        if "==" in text:
            _append_token(tokens, "EQ_TEST", line)
        if ">=" in text or "<=" in text or " > " in f" {text} " or " < " in f" {text} ":
            _append_token(tokens, "RANGE_TEST", line)
        if "[" in text and "]" in text:
            _append_token(tokens, "ARRAY_READ", line)
    elif node_type in {"local_variable_declaration", "declaration", "variable_declarator", "init_declarator"}:
        if "stringbuilder" in text or "stringstream" in text or "ostringstream" in text:
            _append_token(tokens, "ACCUM_INIT", line)
        if "= \"\"" in text or "=''" in text or '= ""' in text:
            _append_token(tokens, "ACCUM_INIT", line)
        if "length() - 1" in text or ".length()-1" in text:
            _append_token(tokens, "REVERSE_INDEX_INIT", line)
        if "= 0" in text or "=0" in text:
            _append_token(tokens, "INIT_ZERO", line)
        if ".size() - 1" in text or ".size()-1" in text or "- 1" in text:
            _append_token(tokens, "INIT_HIGH", line)
        if "vector" in text or "array" in text:
            _append_token(tokens, "CONTAINER_INIT", line)
        if "map" in text or "unordered_map" in text or "hashmap" in text:
            _append_token(tokens, "MAP_INIT", line)
        if "set" in text or "unordered_set" in text:
            _append_token(tokens, "SET_INIT", line)
    elif node_type in {"object_creation_expression", "new_expression"}:
        if "stringbuilder" in text:
            _append_token(tokens, "ACCUM_INIT", line)
    elif node_type in {"subscript_expression", "array_access"}:
        _append_token(tokens, "ARRAY_READ", line)
    elif node_type in {"conditional_expression"}:
        _append_token(tokens, "TERNARY_EXPR", line)


def normalize_ast(node, tokens):
    node_type = node.type
    line = node.start_point[0] + 1

    if node_type in IGNORE_NODE_TYPES:
        for child in node.children:
            normalize_ast(child, tokens)
        return

    if node_type in LOOP_TYPES:
        _append_token(tokens, "LOOP_START", line)
        for child in _get_body_children(node):
            normalize_ast(child, tokens)
        _append_token(tokens, "LOOP_END", node.end_point[0] + 1)
        return

    if node_type in IF_TYPES:
        _append_token(tokens, "IF", line)
        for child in _get_body_children(node):
            normalize_ast(child, tokens)
        _append_token(tokens, "IF_END", node.end_point[0] + 1)
        return

    if node_type in METHOD_TYPES:
        _append_token(tokens, "FUNC_DEF", line)
        for child in _get_body_children(node):
            normalize_ast(child, tokens)
        _append_token(tokens, "FUNC_END", node.end_point[0] + 1)
        return

    if node_type in CLASS_TYPES:
        _append_token(tokens, "CLASS", line)
        for child in _get_body_children(node):
            normalize_ast(child, tokens)
        _append_token(tokens, "CLASS_END", node.end_point[0] + 1)
        return

    if node_type in SWITCH_TYPES:
        _append_token(tokens, "SWITCH", line)
        for child in _get_body_children(node):
            normalize_ast(child, tokens)
        _append_token(tokens, "SWITCH_END", node.end_point[0] + 1)
        return

    token_str = LEXICAL_MAP.get(node_type) or STRUCTURAL_MAP.get(node_type)
    if token_str:
        _append_token(tokens, token_str, line)

    if node_type in {
        "assignment_expression", "update_expression", "binary_expression",
        "local_variable_declaration", "declaration", "variable_declarator",
        "object_creation_expression", "subscript_expression", "array_access",
        "init_declarator",
        "new_expression",
        "conditional_expression",
    }:
        _emit_expr_semantics(node, tokens)
    elif node_type in {"method_invocation", "call_expression"}:
        _emit_call_semantics(node, tokens)

    for child in node.children:
        normalize_ast(child, tokens)


def collect_structural_spans(node, spans):
    unit_type = STRUCTURE_TYPES.get(node.type)
    if unit_type:
        loop_subtype = None
        if unit_type == "LOOP":
            if node.type in {"for_statement", "enhanced_for_statement"}:
                loop_subtype = "for"
            elif node.type == "for_range_loop":
                loop_subtype = "range_for"
            elif node.type == "while_statement":
                loop_subtype = "while"
            elif node.type == "do_statement":
                loop_subtype = "do_while"
        spans.append(
            {
                "type": unit_type,
                "start": node.start_point[0] + 1,
                "end": node.end_point[0] + 1,
                "name": _extract_unit_name(node),
                "loop_subtype": loop_subtype,
            }
        )

    for child in node.children:
        collect_structural_spans(child, spans)


def _span_sort_key(span):
    length = span["end"] - span["start"] + 1
    return (UNIT_PRIORITY.get(span["type"], 999), length, span["start"], span["end"])


def find_enclosing_unit(start_line, end_line, spans):
    candidates = [span for span in spans if span["start"] <= start_line and span["end"] >= end_line]
    if not candidates:
        return None
    return min(candidates, key=_span_sort_key)


def find_enclosing_unit_of_type(start_line, end_line, spans, allowed_types):
    candidates = [
        span for span in spans
        if span["type"] in allowed_types and span["start"] <= start_line and span["end"] >= end_line
    ]
    if not candidates:
        return None
    return min(candidates, key=lambda s: (s["end"] - s["start"] + 1, s["start"], s["end"]))


def normalize_package(directory_path, student_id):
    valid_exts = {".java", ".cpp", ".cc", ".c", ".h", ".hpp", ".cxx", ".hxx", ".C"}
    files = []

    for root, _, filenames in os.walk(directory_path):
        for filename in filenames:
            if filename.startswith("._") or "__MACOSX" in root:
                continue
            ext = os.path.splitext(filename)[1]
            if ext in valid_exts:
                files.append((os.path.join(root, filename), ext))

    files.sort()
    file_data = []

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

            file_spans = []
            collect_structural_spans(tree.root_node, file_spans)
            file_spans.sort(key=_span_sort_key)

            rel_path = os.path.relpath(path, directory_path).replace("\\", "/")
            for tok in file_tokens:
                tok["file"] = rel_path
                tok["student"] = student_id

            file_data.append({"path": rel_path, "tokens": file_tokens, "spans": file_spans})
        except Exception as e:
            print(f"Error parsing {path}: {e}")

    return file_data


def kgrams(tokens, k, spans):
    total_tokens = len(tokens)
    min_diversity = 2 if total_tokens < 60 else MIN_TOKEN_DIVERSITY

    grams = []
    for i in range(len(tokens) - k + 1):
        window = tokens[i : i + k]

        if len({t["file"] for t in window}) > 1:
            continue

        token_types = {t["t"] for t in window}
        if len(token_types) < min_diversity:
            continue

        start_line = window[0]["line"]
        end_line = window[-1]["line"]
        unit = find_enclosing_unit(start_line, end_line, spans)
        loop_unit = find_enclosing_unit_of_type(start_line, end_line, spans, {"LOOP"})
        method_unit = find_enclosing_unit_of_type(start_line, end_line, spans, {"METHOD"})

        content_str = " ".join(t["t"] for t in window)
        meta = {
            "hash": None,
            "file": window[0]["file"],
            "start": start_line,
            "end": end_line,
            "k": k,
            "unit_type": unit["type"] if unit else None,
            "unit_start": unit["start"] if unit else None,
            "unit_end": unit["end"] if unit else None,
            "unit_name": unit.get("name") if unit else None,
            "loop_start": loop_unit["start"] if loop_unit else None,
            "loop_end": loop_unit["end"] if loop_unit else None,
            "loop_subtype": loop_unit.get("loop_subtype") if loop_unit else None,
            "method_start": method_unit["start"] if method_unit else None,
            "method_end": method_unit["end"] if method_unit else None,
            "method_name": method_unit.get("name") if method_unit else None,
        }
        grams.append((content_str, meta))
    return grams


def hash_kgrams(kgrams_list):
    hashed_list = []
    for content_str, meta in kgrams_list:
        meta["hash"] = stable_hash128(content_str)
        hashed_list.append(meta)
    return hashed_list


def winnow(hashed_grams, w):
    if not hashed_grams:
        return []
    if len(hashed_grams) < w:
        return [min(hashed_grams, key=lambda g: (g["hash"], g["start"], g["end"]))]

    fingerprints = []
    last_min_idx = -1

    for i in range(len(hashed_grams) - w + 1):
        window = hashed_grams[i : i + w]
        min_hash_val = min(g["hash"] for g in window)

        min_idx_abs = i
        for j in range(w - 1, -1, -1):
            if window[j]["hash"] == min_hash_val:
                min_idx_abs = i + j
                break

        if min_idx_abs != last_min_idx:
            fingerprints.append(hashed_grams[min_idx_abs])
            last_min_idx = min_idx_abs

    return fingerprints


def _load_zip_source_cache(zip_path):
    cache = {}
    try:
        with zipfile.ZipFile(zip_path, "r") as z:
            for name in z.namelist():
                try:
                    cache[name.replace("\\", "/")] = z.read(name).decode("utf-8", errors="ignore")
                except Exception:
                    cache[name.replace("\\", "/")] = ""
    except Exception:
        pass
    return cache


def _strip_comments(source: str) -> str:
    source = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group().count("\n"), source, flags=re.DOTALL)
    source = re.sub(r"//[^\n]*", "", source)
    return source


def _lookup_source(source_cache, student_id, internal_path):
    student_files = source_cache.get(student_id, {})
    target = internal_path.replace("\\", "/")
    if target in student_files:
        return _strip_comments(student_files[target])
    for cached_path, content in student_files.items():
        normalized = cached_path.replace("\\", "/")
        if normalized.endswith(target):
            return _strip_comments(content)
    return ""


def process_zip_submission(zip_path, extract_root):
    student_id = os.path.splitext(os.path.basename(zip_path))[0]
    extract_path = os.path.join(extract_root, student_id)
    try:
        with zipfile.ZipFile(zip_path, "r") as zr:
            zr.extractall(extract_path)
        resolve_nested_zips(extract_path)

        file_data = normalize_package(extract_path, student_id)

        all_fps = []
        k_map = {}

        for file_info in file_data:
            rel_path = file_info["path"]
            tokens = file_info["tokens"]
            spans = file_info["spans"]

            k = adaptive_k(len(tokens))
            k_map[rel_path] = k
            grams = kgrams(tokens, k, spans)
            hashed = hash_kgrams(grams)
            fps = winnow(hashed, w=adaptive_window(len(tokens)))
            all_fps.extend(fps)

        return student_id, all_fps, k_map
    except zipfile.BadZipFile:
        return student_id, [], {}


def load_boilerplate_hashes(template_dir):
    if not os.path.exists(template_dir) or not os.listdir(template_dir):
        return set()

    file_data = normalize_package(template_dir, "TEMPLATE")

    all_fps = []
    all_raw = []
    for file_info in file_data:
        tokens = file_info["tokens"]
        spans = file_info["spans"]
        k = adaptive_k(len(tokens))
        grams = kgrams(tokens, k, spans)
        hashed = hash_kgrams(grams)
        fps = winnow(hashed, w=adaptive_window(len(tokens)))
        all_fps.extend(fps)
        all_raw.extend(hashed)

    return {fp["hash"] for fp in all_fps} | {fp["hash"] for fp in all_raw}


def build_inverted_index(fingerprint_db):
    inverted = {}
    for student_id, fps in fingerprint_db.items():
        for fp in fps:
            h = fp["hash"]
            if h not in inverted:
                inverted[h] = set()
            inverted[h].add(student_id)
    return inverted


def candidate_pairs_from_index(inverted_index):
    candidates = set()
    for students in inverted_index.values():
        if len(students) > 1:
            for pair in itertools.combinations(sorted(students), 2):
                candidates.add(pair)
    return candidates


def build_idf_weights(inverted_index, total_students):
    weights = {}
    for h, students in inverted_index.items():
        doc_freq = len(students)
        weights[h] = 1.0 / math.log(1 + doc_freq)
    return weights


def _compatible_units(fa, fb):
    uta, utb = fa.get("unit_type"), fb.get("unit_type")

    if not uta or not utb:
        return True

    if uta == utb:
        return True

    compatible_pairs = {
        ("METHOD", "LOOP"), ("LOOP", "METHOD"),
        ("METHOD", "IF"), ("IF", "METHOD"),
        ("METHOD", "SWITCH"), ("SWITCH", "METHOD"),
        ("LOOP", "IF"), ("IF", "LOOP"),
        ("LOOP", "SWITCH"), ("SWITCH", "LOOP"),
    }
    return (uta, utb) in compatible_pairs


def compare_fingerprints(fp_a, fp_b, idf_weights):
    map_a = {}
    for fp in fp_a:
        map_a.setdefault(fp["hash"], []).append(fp)

    matches = []
    for fb in fp_b:
        h = fb["hash"]
        if h in map_a:
            for fa in map_a[h]:
                if not _compatible_units(fa, fb):
                    continue
                matches.append(
                    {
                        "hash": str(h),
                        "file_a": fa["file"],
                        "start_a": fa["start"],
                        "end_a": fa["end"],
                        "unit_type_a": fa.get("unit_type"),
                        "unit_start_a": fa.get("unit_start"),
                        "unit_end_a": fa.get("unit_end"),
                        "unit_name_a": fa.get("unit_name"),
                        "loop_start_a": fa.get("loop_start"),
                        "loop_end_a": fa.get("loop_end"),
                        "loop_subtype_a": fa.get("loop_subtype"),
                        "method_start_a": fa.get("method_start"),
                        "method_end_a": fa.get("method_end"),
                        "method_name_a": fa.get("method_name"),
                        "file_b": fb["file"],
                        "start_b": fb["start"],
                        "end_b": fb["end"],
                        "unit_type_b": fb.get("unit_type"),
                        "unit_start_b": fb.get("unit_start"),
                        "unit_end_b": fb.get("unit_end"),
                        "unit_name_b": fb.get("unit_name"),
                        "loop_start_b": fb.get("loop_start"),
                        "loop_end_b": fb.get("loop_end"),
                        "loop_subtype_b": fb.get("loop_subtype"),
                        "method_start_b": fb.get("method_start"),
                        "method_end_b": fb.get("method_end"),
                        "method_name_b": fb.get("method_name"),
                    }
                )

    set_a = {f["hash"] for f in fp_a}
    set_b = {f["hash"] for f in fp_b}
    union_hashes = set_a | set_b
    intersection_hashes = set_a & set_b

    w_intersection = sum(idf_weights.get(h, 1.0) for h in intersection_hashes)
    w_union = sum(idf_weights.get(h, 1.0) for h in union_hashes)
    score = w_intersection / w_union if w_union > 0 else 0.0
    return score, matches


def _loop_contained_in_method(match):
    ls_a = match.get("loop_start_a")
    le_a = match.get("loop_end_a")
    ms_a = match.get("method_start_a")
    me_a = match.get("method_end_a")

    ls_b = match.get("loop_start_b")
    le_b = match.get("loop_end_b")
    ms_b = match.get("method_start_b")
    me_b = match.get("method_end_b")

    side_a_contained = (
        ls_a is not None and le_a is not None and
        ms_a is not None and me_a is not None and
        ms_a <= ls_a and le_a <= me_a
    )
    side_b_contained = (
        ls_b is not None and le_b is not None and
        ms_b is not None and me_b is not None and
        ms_b <= ls_b and le_b <= me_b
    )

    return side_a_contained and side_b_contained


def _reporting_unit_key(match):
    has_loop_a = (
        match.get("loop_start_a") is not None and match.get("loop_end_a") is not None
    )
    has_loop_b = (
        match.get("loop_start_b") is not None and match.get("loop_end_b") is not None
    )
    has_method_a = (
        match.get("method_start_a") is not None and match.get("method_end_a") is not None
    )
    has_method_b = (
        match.get("method_start_b") is not None and match.get("method_end_b") is not None
    )

    if has_loop_a and has_loop_b:
        if not (has_method_a and has_method_b and _loop_contained_in_method(match)):
            return (
                "LOOP",
                match["file_a"], match["file_b"],
                match["loop_start_a"], match["loop_end_a"],
                match["loop_start_b"], match["loop_end_b"],
                match.get("method_name_a"), match.get("method_name_b"),
            )

    if has_method_a and has_method_b:
        return (
            "METHOD",
            match["file_a"], match["file_b"],
            match["method_start_a"], match["method_end_a"],
            match["method_start_b"], match["method_end_b"],
            match.get("method_name_a"), match.get("method_name_b"),
        )

    return None


def _blocks_overlap(method_block, loop_block):
    return (
        method_block["file_a"] == loop_block["file_a"] and
        method_block["file_b"] == loop_block["file_b"] and
        method_block["start_a"] <= loop_block["start_a"] and
        loop_block["end_a"] <= method_block["end_a"] and
        method_block["start_b"] <= loop_block["start_b"] and
        loop_block["end_b"] <= method_block["end_b"]
    )


def _absorb_nested_loops(merged_blocks):
    method_blocks = [b for b in merged_blocks if b.get("unit_type_a") == "METHOD"]
    loop_blocks = [b for b in merged_blocks if b.get("unit_type_a") == "LOOP"]
    other_blocks = [
        b for b in merged_blocks
        if b.get("unit_type_a") not in ("METHOD", "LOOP")
    ]

    absorbed_indices = set()
    for li, lb in enumerate(loop_blocks):
        for mb in method_blocks:
            if _blocks_overlap(mb, lb):
                mb["hash_count"] += lb["hash_count"]
                mb["raw_match_count"] += lb["raw_match_count"]
                mb["start_a"] = min(mb["start_a"], lb["start_a"])
                mb["end_a"] = max(mb["end_a"], lb["end_a"])
                mb["start_b"] = min(mb["start_b"], lb["start_b"])
                mb["end_b"] = max(mb["end_b"], lb["end_b"])
                mb.setdefault("loop_subtypes_a", set()).update(lb.get("loop_subtypes_a", set()))
                mb.setdefault("loop_subtypes_b", set()).update(lb.get("loop_subtypes_b", set()))
                absorbed_indices.add(li)
                break

    surviving_loops = [lb for li, lb in enumerate(loop_blocks) if li not in absorbed_indices]
    return method_blocks + surviving_loops + other_blocks


def group_and_merge_matches(matches, min_block_size=3):
    grouped = {}
    for m in matches:
        key = _reporting_unit_key(m)
        if key is None:
            continue
        grouped.setdefault(key, []).append(m)

    merged_blocks = []
    for key, items in grouped.items():
        unit_type, file_a, file_b, start_a, end_a, start_b, end_b, method_name_a, method_name_b = key
        block_length_a = end_a - start_a + 1
        block_length_b = end_b - start_b + 1
        if max(block_length_a, block_length_b) < min_block_size:
            continue

        unique_hashes = {item["hash"] for item in items}
        loop_subtypes_a = {item.get("loop_subtype_a") for item in items} - {None}
        loop_subtypes_b = {item.get("loop_subtype_b") for item in items} - {None}
        merged_blocks.append(
            {
                "file_a": file_a,
                "file_b": file_b,
                "start_a": start_a,
                "end_a": end_a,
                "start_b": start_b,
                "end_b": end_b,
                "hash_count": len(unique_hashes),
                "raw_match_count": len(items),
                "unit_type_a": unit_type,
                "unit_type_b": unit_type,
                "unit_name_a": method_name_a if unit_type == "METHOD" else None,
                "unit_name_b": method_name_b if unit_type == "METHOD" else None,
                "parent_method_name_a": method_name_a,
                "parent_method_name_b": method_name_b,
                "loop_subtypes_a": loop_subtypes_a,
                "loop_subtypes_b": loop_subtypes_b,
            }
        )

    merged_blocks = _absorb_nested_loops(merged_blocks)
    merged_blocks.sort(key=lambda b: (b["file_a"], b["start_a"], b["file_b"], b["start_b"], b["unit_type_a"]))
    return merged_blocks


def _names_match(a, b):
    a = (a or "").strip().lower()
    b = (b or "").strip().lower()
    return bool(a and b and a == b)


def _method_context_compatible(block):
    # This function is only ever called in cross-student comparisons.
    # File paths are stored relative to each student's submission directory,
    # so same-named files (e.g. utils.cpp from Ref E and utils.cpp from Ref F)
    # both appear as "utils.cpp" — but they are NOT the same file.
    # Filtering based on method-name mismatches in "same-named" files incorrectly
    # suppresses legitimate plagiarism signals (students often rename functions
    # to obscure copying). The density threshold in _strong_blocks is sufficient.
    return True


def _name_score(block):
    if not _same_logical_file(block.get("file_a", ""), block.get("file_b", "")):
        return 0.0
    uta = block.get("unit_type_a")
    utb = block.get("unit_type_b")
    if uta == "METHOD" and utb == "METHOD":
        na = block.get("unit_name_a")
        nb = block.get("unit_name_b")
        if _names_match(na, nb):
            return 0.25
        if na and nb:
            return -0.15
    pma = block.get("parent_method_name_a")
    pmb = block.get("parent_method_name_b")
    if _names_match(pma, pmb):
        return 0.12
    if pma and pmb:
        return -0.25
    return 0.0


def _compute_block_density(block):
    block_length_a = block["end_a"] - block["start_a"] + 1
    block_length_b = block["end_b"] - block["start_b"] + 1
    denom = max(block_length_a, block_length_b)
    density = block["hash_count"] / denom if denom > 0 else 0.0
    return block_length_a, block_length_b, density


def _min_hashes_for_block(block_length_a, block_length_b):
    short_len = min(block_length_a, block_length_b)
    return 1 if short_len <= 8 else UNIT_MIN_HASHES


def _candidate_assignment_score(block):
    block_length_a, block_length_b, density = _compute_block_density(block)
    shorter = max(1, min(block_length_a, block_length_b))
    longer = max(1, max(block_length_a, block_length_b))
    coverage = min(1.0, block["hash_count"] / shorter)
    length_balance = 1.0 - abs(block_length_a - block_length_b) / longer
    unit_match_bonus = 0.08 if block.get("unit_type_a") == block.get("unit_type_b") else -0.12
    return (
        density * 0.52
        + coverage * 0.18
        + length_balance * 0.10
        + unit_match_bonus
        + _name_score(block)
        + min(block["hash_count"], 6) * 0.005
    )


def _select_one_to_one_blocks(blocks):
    grouped = {}
    for block in blocks:
        key = (
            os.path.basename(block["file_a"]).lower(),
            os.path.basename(block["file_b"]).lower(),
            block.get("unit_type_a"),
            block.get("unit_type_b"),
        )
        grouped.setdefault(key, []).append(block)

    selected = []
    for key, candidates in grouped.items():
        scored = []
        for block in candidates:
            scored.append((_candidate_assignment_score(block), block))
        scored.sort(
            key=lambda item: (
                item[0],
                item[1]["hash_count"],
                -abs((item[1]["end_a"] - item[1]["start_a"]) - (item[1]["end_b"] - item[1]["start_b"])),
            ),
            reverse=True,
        )

        used_a = set()
        used_b = set()
        best_for_a = {}
        best_for_b = {}
        for score, block in scored:
            unit_a = (block["file_a"], block["unit_type_a"], block["start_a"], block["end_a"])
            unit_b = (block["file_b"], block["unit_type_b"], block["start_b"], block["end_b"])
            best_for_a[unit_a] = max(best_for_a.get(unit_a, -10**9), score)
            best_for_b[unit_b] = max(best_for_b.get(unit_b, -10**9), score)

        for score, block in scored:
            unit_a = (block["file_a"], block["unit_type_a"], block["start_a"], block["end_a"])
            unit_b = (block["file_b"], block["unit_type_b"], block["start_b"], block["end_b"])
            if unit_a in used_a or unit_b in used_b:
                continue
            if score < best_for_a[unit_a] - 0.08:
                continue
            if score < best_for_b[unit_b] - 0.08:
                continue
            selected.append(block)
            used_a.add(unit_a)
            used_b.add(unit_b)

    selected.sort(
        key=lambda b: (
            _candidate_assignment_score(b),
            b["hash_count"],
            b["file_a"],
            b["start_a"],
        ),
        reverse=True,
    )
    return selected


def _strong_blocks(merged_blocks):
    strong = []
    for block in merged_blocks:
        unit_a = block.get("unit_type_a")
        unit_b = block.get("unit_type_b")
        if unit_a and unit_a != "RAW" and not _is_reportable_unit(unit_a):
            continue
        if unit_b and unit_b != "RAW" and not _is_reportable_unit(unit_b):
            continue
        if unit_a and unit_b and not _compatible_units(
            {"file": block["file_a"], "unit_type": unit_a},
            {"file": block["file_b"], "unit_type": unit_b},
        ):
            continue

        block_length_a, block_length_b, density = _compute_block_density(block)
        min_hashes = _min_hashes_for_block(block_length_a, block_length_b)
        if block["hash_count"] < min_hashes:
            continue

        block_with_density = {**block, "density": density}
        if not _method_context_compatible(block_with_density):
            continue

        density_threshold = UNIT_MATCH_THRESHOLD
        if min(block_length_a, block_length_b) <= 8:
            density_threshold = max(0.10, UNIT_MATCH_THRESHOLD - 0.06)
        elif min(block_length_a, block_length_b) <= 15:
            density_threshold = max(0.14, UNIT_MATCH_THRESHOLD - 0.03)

        if density < density_threshold:
            continue

        strong.append({
            **block,
            "density": density,
            "block_length_a": block_length_a,
            "block_length_b": block_length_b,
        })
    strong = _select_one_to_one_blocks(strong)
    strong.sort(
        key=lambda b: (
            _candidate_assignment_score(b),
            b["density"],
            b["hash_count"],
            min(b["block_length_a"], b["block_length_b"]),
        ),
        reverse=True,
    )
    return strong


def should_flag_pair(score, raw_matches):
    merged_blocks = group_and_merge_matches(raw_matches)
    strong = _strong_blocks(merged_blocks)

    if not strong:
        return False

    if score >= SIMILARITY_THRESHOLD:
        return True

    distinct_files = {os.path.basename(b["file_a"]) for b in strong}
    distinct_unit_pairs = {
        (b["file_a"], b["start_a"], b["end_a"], b["file_b"], b["start_b"], b["end_b"], b["unit_type_a"])
        for b in strong
    }

    if len(strong) >= 2 and len(distinct_files) >= 2 and len(distinct_unit_pairs) >= 2:
        return True

    method_strong = [b for b in strong if b.get("unit_type_a") == "METHOD"]
    if len(method_strong) >= 2:
        return True

    if strong and strong[0]["density"] >= 0.62 and strong[0]["hash_count"] >= 3:
        return True

    return False


def _file_level_similarity(fp_a, fp_b):
    files_a = {}
    files_b = {}
    for fp in fp_a:
        files_a.setdefault(fp["file"], set()).add(fp["hash"])
    for fp in fp_b:
        files_b.setdefault(fp["file"], set()).add(fp["hash"])

    results = []
    for fname in files_a:
        match_key = next(
            (f for f in files_b if os.path.basename(f).lower() == os.path.basename(fname).lower()),
            None
        )
        if not match_key:
            continue
        set_a = files_a[fname]
        set_b = files_b[match_key]
        union = set_a | set_b
        intersection = set_a & set_b
        if not union:
            continue
        similarity = len(intersection) / len(union)
        results.append({
            "file_a": fname,
            "file_b": match_key,
            "similarity": round(similarity, 3),
            "hash_count": len(intersection),
        })
    return results


def build_pair_object(s1, s2, score, raw_matches, source_cache, fp_a=None, fp_b=None):
    merged_blocks = group_and_merge_matches(raw_matches)
    strong = _strong_blocks(merged_blocks)

    if score >= SIMILARITY_THRESHOLD:
        selected_blocks = strong[:12]
        if not selected_blocks:
            fallback = []
            for block in merged_blocks:
                unit_a = block.get("unit_type_a")
                unit_b = block.get("unit_type_b")
                if unit_a and unit_a != "RAW" and not _is_reportable_unit(unit_a):
                    continue
                if unit_b and unit_b != "RAW" and not _is_reportable_unit(unit_b):
                    continue
                if unit_a and unit_b and not _compatible_units({"file": block["file_a"], "unit_type": unit_a}, {"file": block["file_b"], "unit_type": unit_b}):
                    continue
                block_length_a, block_length_b, density = _compute_block_density(block)
                if density < 0.2:
                    continue
                fallback.append({**block, "density": density, "block_length_a": block_length_a, "block_length_b": block_length_b})
            fallback.sort(key=lambda b: (b["density"], b["hash_count"]), reverse=True)
            selected_blocks = fallback[:8]
    else:
        selected_blocks = strong[:12]

    structured_blocks = []
    highlight_map = {s1: {}, s2: {}}
    total_lines_a = 0
    total_lines_b = 0
    high_conf_blocks = 0
    density_sum = 0.0

    file_level_files = set()
    if fp_a and fp_b:
        for fs in _file_level_similarity(fp_a, fp_b):
            if fs["similarity"] >= FILE_SIMILARITY_THRESHOLD:
                fname = os.path.basename(fs["file_a"])
                file_level_files.add(fname)
                fname_b = os.path.basename(fs["file_b"])
                matches_for_file = [
                    m for m in raw_matches
                    if os.path.basename(m["file_a"]).lower() == fname.lower()
                    and os.path.basename(m["file_b"]).lower() == fname_b.lower()
                ]
                if matches_for_file:
                    start_a = 1
                    start_b = 1
                    end_a = max(m["end_a"] for m in matches_for_file)
                    end_b = max(m["end_b"] for m in matches_for_file)
                else:
                    start_a = start_b = 1
                    end_a = end_b = 1
                block_length_a = end_a - start_a + 1
                block_length_b = end_b - start_b + 1
                density_sum += fs["similarity"]
                total_lines_a += block_length_a
                total_lines_b += block_length_b
                high_conf_blocks += 1
                idx = len(structured_blocks) + 1
                structured_blocks.append({
                    "block_id": idx,
                    "file_a": fs["file_a"],
                    "file_b": fs["file_b"],
                    "start_a": start_a,
                    "end_a": end_a,
                    "start_b": start_b,
                    "end_b": end_b,
                    "block_length_a": block_length_a,
                    "block_length_b": block_length_b,
                    "density": fs["similarity"],
                    "confidence": "HIGH",
                    "unit_type_a": "FILE",
                    "unit_type_b": "FILE",
                    "unit_name_a": fname,
                    "unit_name_b": fname,
                })
                highlight_map[s1].setdefault(fs["file_a"], []).append({
                    "block_id": idx,
                    "start": start_a,
                    "end": end_a,
                    "unit_type": "FILE",
                })
                highlight_map[s2].setdefault(fs["file_b"], []).append({
                    "block_id": idx,
                    "start": start_b,
                    "end": end_b,
                    "unit_type": "FILE",
                })

    for block in selected_blocks:
        if os.path.basename(block.get("file_a", "")).lower() in {f.lower() for f in file_level_files}:
            continue
        idx = len(structured_blocks) + 1
        block_length_a, block_length_b, density = _compute_block_density(block)

        short_len = min(block_length_a, block_length_b)
        short_block = short_len <= 8
        hash_count = block["hash_count"]
        confidence = "LOW"
        if short_block:
            high_thresh, med_thresh = 0.38, 0.25
            high_hash_ok = hash_count >= 3
        elif short_len <= 20:
            high_thresh, med_thresh = 0.50, 0.28
            high_hash_ok = True
        elif short_len <= 40:
            high_thresh, med_thresh = 0.60, 0.35
            high_hash_ok = True
        else:
            high_thresh, med_thresh = 0.75, 0.55
            high_hash_ok = True
        if density >= high_thresh and high_hash_ok:
            confidence = "HIGH"
            high_conf_blocks += 1
        elif density >= med_thresh:
            confidence = "MEDIUM"

        if confidence == "HIGH":
            lsa = block.get("loop_subtypes_a", set())
            lsb = block.get("loop_subtypes_b", set())
            if lsa and lsb and lsa != lsb:
                confidence = "MEDIUM"
                high_conf_blocks -= 1

        density_sum += density
        total_lines_a += block_length_a
        total_lines_b += block_length_b

        structured_blocks.append(
            {
                "block_id": idx,
                "file_a": block["file_a"],
                "file_b": block["file_b"],
                "start_a": block["start_a"],
                "end_a": block["end_a"],
                "start_b": block["start_b"],
                "end_b": block["end_b"],
                "block_length_a": block_length_a,
                "block_length_b": block_length_b,
                "density": round(density, 3),
                "confidence": confidence,
                "unit_type_a": block.get("unit_type_a", "RAW"),
                "unit_type_b": block.get("unit_type_b", "RAW"),
                "unit_name_a": block.get("unit_name_a"),
                "unit_name_b": block.get("unit_name_b"),
            }
        )

        highlight_map[s1].setdefault(block["file_a"], []).append(
            {
                "block_id": idx,
                "start": block["start_a"],
                "end": block["end_a"],
                "unit_type": block.get("unit_type_a", "RAW"),
            }
        )
        highlight_map[s2].setdefault(block["file_b"], []).append(
            {
                "block_id": idx,
                "start": block["start_b"],
                "end": block["end_b"],
                "unit_type": block.get("unit_type_b", "RAW"),
            }
        )

    n = len(structured_blocks)
    avg_density = density_sum / n if n else 0.0
    severity_score = score * 0.45 + avg_density * 0.35 + (high_conf_blocks / n * 0.2 if n else 0.0)

    sources = {s1: {}, s2: {}}
    for sid in (s1, s2):
        for file_name in highlight_map[sid]:
            sources[sid][file_name] = _lookup_source(source_cache, sid, file_name)

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


def run_engine(submissions_folder, boilerplate_folder=None,
               similarity_threshold=0.15, parallel=True):
    """Run the plagiarism detection pipeline.

    Returns dict with ``metadata`` and ``pairs`` keys.
    """
    boilerplate_hashes = load_boilerplate_hashes(boilerplate_folder) if boilerplate_folder else set()

    zip_files = [f for f in os.listdir(submissions_folder) if f.endswith(".zip")]

    fingerprint_db = {}
    source_cache = {}
    k_map_db = {}

    with tempfile.TemporaryDirectory() as temp_dir:
        full_paths = [os.path.join(submissions_folder, zf) for zf in zip_files]

        if parallel and len(full_paths) > 1:
            with ProcessPoolExecutor() as executor:
                future_to_path = {
                    executor.submit(process_zip_submission, path, temp_dir): path
                    for path in full_paths
                }
                for future in as_completed(future_to_path):
                    s_id, fps, k_map = future.result()
                    fingerprint_db[s_id] = fps
                    k_map_db[s_id] = k_map
                    source_cache[s_id] = _load_zip_source_cache(future_to_path[future])
        else:
            for path in full_paths:
                s_id, fps, k_map = process_zip_submission(path, temp_dir)
                fingerprint_db[s_id] = fps
                k_map_db[s_id] = k_map
                source_cache[s_id] = _load_zip_source_cache(path)

    if boilerplate_hashes:
        fingerprint_db = {
            s_id: [fp for fp in fps if fp["hash"] not in boilerplate_hashes]
            for s_id, fps in fingerprint_db.items()
        }

    # Separate real students from _ref_ reference submissions
    all_ids = list(fingerprint_db.keys())
    real_ids = [s for s in all_ids if not s.startswith("_ref_")]
    ref_ids = [s for s in all_ids if s.startswith("_ref_")]

    # If there are no real student submissions, compare references against each
    # other (useful for testing or when refs are the only available data).
    if not real_ids and ref_ids:
        real_ids = ref_ids
        ref_ids = []

    total_students = len(fingerprint_db)
    inverted_index = build_inverted_index(fingerprint_db)
    idf_weights = build_idf_weights(inverted_index, total_students)
    candidates = candidate_pairs_from_index(inverted_index)

    # Filter out ref-vs-ref pairs
    ref_set = set(ref_ids)
    pairs_to_check = [
        (s1, s2) for s1, s2 in candidates
        if not (s1 in ref_set and s2 in ref_set)
    ]

    total_pairs_possible = (
        len(list(itertools.combinations(real_ids, 2)))
        + len(real_ids) * len(ref_ids)
    )

    flagged_pairs = []

    for s1, s2 in pairs_to_check:
        score, matches = compare_fingerprints(
            fingerprint_db[s1], fingerprint_db[s2], idf_weights
        )

        if should_flag_pair(score, matches):
            clean_pair = build_pair_object(
                s1, s2, score, matches, source_cache,
                fp_a=fingerprint_db[s1],
                fp_b=fingerprint_db[s2],
            )
            flagged_pairs.append(clean_pair)

    flagged_pairs.sort(key=lambda x: x["severity_score"], reverse=True)

    return {
        "metadata": {
            "total_students": len(real_ids),
            "total_pairs_possible": total_pairs_possible,
            "candidate_pairs_evaluated": len(pairs_to_check),
            "pairs_flagged": len(flagged_pairs),
            "similarity_threshold": similarity_threshold,
            "boilerplate_hashes_filtered": len(boilerplate_hashes),
            "reference_submissions": len(ref_ids),
        },
        "pairs": flagged_pairs,
    }
