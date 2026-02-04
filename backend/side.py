from tree_sitter import Language, Parser
import tree_sitter_python as tspython

PY_LANGUAGE = Language(tspython.language())
parser = Parser()
parser.language = PY_LANGUAGE

# --- Normalization rules ---

# These are leaf-like lexical nodes we want to map to abstract tokens.
LEXICAL_MAP = {
    "identifier": "ID",      # variable / function names
    "integer": "NUM",
    "float": "NUM",
    "string": "STR",
    "true": "BOOL",
    "false": "BOOL",
}

# Nodes we consider structural and want to emit a label for.
STRUCTURAL_MAP = {
    "module": "MODULE",
    "function_definition": "FUNC_DEF",
    "assignment": "ASSIGN",          # simple assignment
    "augmented_assignment": "PLUS_ASSIGN",  # x += y, we treat as PLUS_ASSIGN for now
    "for_statement": "LOOP_START",
    "while_statement": "LOOP_START",
    "if_statement": "IF",
    "else_clause": "ELSE",
    "return_statement": "RETURN",
    "call": "CALL",
    "binary_operator": "BIN_OP",
    "comparison_operator": "CMP_OP",
}

# Node types that are pure noise for *logic*.
IGNORE_NODE_TYPES = {
    "comment",
    "ERROR",                # parser error nodes
    "expression_statement", # wrapper nodes
    "block",
    "parameter_list",
    "argument_list",
    "parenthesized_expression",
}


def normalize_ast(node, tokens):
    """
    Walk the tree-sitter AST and emit a normalized token stream
    that roughly matches your PDF semantics:
      - ID / NUM / STR / BOOL for lexical stuff
      - ASSIGN / LOOP_START / PLUS_ASSIGN / etc. for structure
    """
    # Ignore wrapper / noise nodes, but still recurse into children
    if node.type in IGNORE_NODE_TYPES:
        for child in node.children:
            normalize_ast(child, tokens)
        return

    # Lexical normalization
    if node.type in LEXICAL_MAP:
        tokens.append(LEXICAL_MAP[node.type])

    # Structural normalization
    elif node.type in STRUCTURAL_MAP:
        tokens.append(STRUCTURAL_MAP[node.type])

    # Special pattern: try to detect "x = x + 1" and treat as INCREMENT
    # (You can refine this later with more precise pattern matching)
    # For now, we keep BIN_OP and ASSIGN; INCREMENT is more advanced.

    # Always recurse into children
    for child in node.children:
        normalize_ast(child, tokens)


def normalize_file(path):
    with open(path, "rb") as f:
        code = f.read()
    tree = parser.parse(code)
    root = tree.root_node
    tokens = []
    normalize_ast(root, tokens)
    return tokens


if __name__ == "__main__":
    toks = normalize_file("test1.py")
    print("Normalized tokens for test1.py:")
    print(toks)


def kgrams(tokens, k=3):
    """
    Return list of k-gram tuples from token sequence.
    Example: tokens = [A,B,C,D], k=3 → [(A,B,C), (B,C,D)]
    """
    grams = []
    n = len(tokens)
    for i in range(n - k + 1):
        grams.append(tuple(tokens[i:i+k]))
    return grams

if __name__ == "__main__":
    toks = normalize_file("test1.py")
    grams = kgrams(toks, k=3)
    print("First few k-grams:")
    for g in grams[:10]:
        print(g)


# ----------------------------------------------------------------------------------------------------


from collections import Counter

def compare_files(path_a, path_b, k=3):
    toks_a = normalize_file(path_a)
    toks_b = normalize_file(path_b)

    kgrams_a = kgrams(toks_a, k)
    kgrams_b = kgrams(toks_b, k)

    # Use multiset (Counter) intersection to allow for repeated k-grams
    ca = Counter(kgrams_a)
    cb = Counter(kgrams_b)

    # Intersection size
    common = ca & cb
    common_count = sum(common.values())

    total_a = sum(ca.values())
    total_b = sum(cb.values())
    union_count = total_a + total_b - common_count

    jaccard = common_count / union_count if union_count > 0 else 0.0

    print(f"File A: {path_a}")
    print(f"File B: {path_b}")
    print(f"Total k-grams A: {total_a}")
    print(f"Total k-grams B: {total_b}")
    print(f"Common k-grams: {common_count}")
    print(f"Jaccard ≈ {jaccard*100:.1f}%")

    return {
        "k": k,
        "kgrams_a": kgrams_a,
        "kgrams_b": kgrams_b,
        "common_count": common_count,
        "jaccard": jaccard,
    }


if __name__ == "__main__":
    result = compare_files("test1.py", "test2.py", k=3)
