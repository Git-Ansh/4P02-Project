"""Unit tests for the comparison engine (AST tokenizer, k-gram, winnowing, Jaccard)."""

import os
import tempfile
import zipfile

from src.services.comparison_engine import (
    K_GRAM_SIZE,
    adaptive_k,
    build_idf_weights,
    build_inverted_index,
    candidate_pairs_from_index,
    compare_fingerprints,
    get_parser,
    group_and_merge_matches,
    hash_kgrams,
    kgrams,
    normalize_ast,
    normalize_package,
    run_engine,
    process_zip_submission,
    winnow,
    _lookup_source,
)


class TestGetParser:
    def test_java(self):
        assert get_parser(".java") is not None

    def test_cpp(self):
        assert get_parser(".cpp") is not None

    def test_c(self):
        assert get_parser(".c") is not None

    def test_header(self):
        assert get_parser(".h") is not None
        assert get_parser(".hpp") is not None

    def test_unsupported(self):
        assert get_parser(".txt") is None
        assert get_parser(".py") is None
        assert get_parser(".rs") is None


class TestNormalizeAST:
    def test_java_tokens(self):
        parser = get_parser(".java")
        code = b"public class Main { public static void main(String[] args) { int x = 5; } }"
        tree = parser.parse(code)
        tokens = []
        normalize_ast(tree.root_node, tokens)
        assert len(tokens) > 0
        types = {t["t"] for t in tokens}
        assert "CLASS" in types
        assert "FUNC_DEF" in types

    def test_cpp_tokens(self):
        parser = get_parser(".cpp")
        code = b"int main() { int x = 5; return 0; }"
        tree = parser.parse(code)
        tokens = []
        normalize_ast(tree.root_node, tokens)
        assert len(tokens) > 0
        types = {t["t"] for t in tokens}
        assert "FUNC_DEF" in types
        assert "RETURN" in types

    def test_ignores_comments(self):
        parser = get_parser(".java")
        code = b"// comment\npublic class Main {}"
        tree = parser.parse(code)
        tokens = []
        normalize_ast(tree.root_node, tokens)
        types = {t["t"] for t in tokens}
        assert "CLASS" in types


class TestNormalizePackage:
    def test_directory_with_java(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with open(os.path.join(tmpdir, "Main.java"), "w") as f:
                f.write("public class Main { public static void main(String[] args) {} }")
            groups = normalize_package(tmpdir, "stu1")
            assert len(groups) >= 1
            rel_path, tokens = groups[0]
            assert len(tokens) > 0
            assert all("file" in t for t in tokens)
            assert all(t["student"] == "stu1" for t in tokens)

    def test_skips_macosx(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            macosx = os.path.join(tmpdir, "__MACOSX")
            os.makedirs(macosx)
            with open(os.path.join(macosx, "Main.java"), "w") as f:
                f.write("class Main {}")
            groups = normalize_package(tmpdir, "stu1")
            assert len(groups) == 0


class TestAdaptiveK:
    def test_tiny_file(self):
        assert adaptive_k(30) == 5

    def test_small_file(self):
        assert adaptive_k(150) == 7

    def test_medium_file(self):
        assert adaptive_k(300) == 9

    def test_large_file(self):
        assert adaptive_k(600) == 11

    def test_boundary_80(self):
        assert adaptive_k(79) == 5
        assert adaptive_k(80) == 7

    def test_boundary_200(self):
        assert adaptive_k(199) == 7
        assert adaptive_k(200) == 9


class TestKgrams:
    def test_generation(self):
        # Use diverse token types to pass the diversity filter
        tokens = [
            {"t": "CLASS", "line": 1, "file": "A.java"},
            {"t": "ID", "line": 1, "file": "A.java"},
            {"t": "FUNC_DEF", "line": 2, "file": "A.java"},
            {"t": "ASSIGN", "line": 2, "file": "A.java"},
            {"t": "NUM", "line": 3, "file": "A.java"},
            {"t": "RETURN", "line": 3, "file": "A.java"},
            {"t": "BIN_OP", "line": 3, "file": "A.java"},
        ]
        grams = kgrams(tokens, k=K_GRAM_SIZE)
        assert len(grams) > 0
        for content, meta in grams:
            assert meta["file"] == "A.java"
            assert meta["k"] == K_GRAM_SIZE

    def test_cross_file_boundary(self):
        tokens = [
            {"t": "CLASS", "line": 1, "file": "A.java"},
            {"t": "ID", "line": 2, "file": "A.java"},
            {"t": "FUNC_DEF", "line": 3, "file": "A.java"},
            {"t": "ASSIGN", "line": 1, "file": "B.java"},
            {"t": "NUM", "line": 2, "file": "B.java"},
        ]
        grams = kgrams(tokens, k=3)
        for content, meta in grams:
            assert meta["file"] in ("A.java", "B.java")

    def test_diversity_filter(self):
        """Windows with < MIN_TOKEN_DIVERSITY distinct types are skipped."""
        tokens = [
            {"t": "ID", "line": 1, "file": "A.java"},
            {"t": "ID", "line": 2, "file": "A.java"},
            {"t": "ID", "line": 3, "file": "A.java"},
            {"t": "ID", "line": 4, "file": "A.java"},
            {"t": "ID", "line": 5, "file": "A.java"},
        ]
        grams = kgrams(tokens, k=5)
        assert len(grams) == 0  # all same type → filtered out


class TestHashAndWinnow:
    def test_hash_kgrams(self):
        grams = [
            ("CLASS ID FUNC_DEF ID ASSIGN", {"hash": None, "file": "A.java", "start": 1, "end": 3}),
        ]
        hashed = hash_kgrams(grams)
        assert len(hashed) == 1
        assert isinstance(hashed[0]["hash"], int)

    def test_winnow_produces_fingerprints(self):
        hashed = [
            {"hash": 10, "file": "A.java", "start": 1, "end": 5},
            {"hash": 20, "file": "A.java", "start": 2, "end": 6},
            {"hash": 5, "file": "A.java", "start": 3, "end": 7},
            {"hash": 30, "file": "A.java", "start": 4, "end": 8},
            {"hash": 15, "file": "A.java", "start": 5, "end": 9},
            {"hash": 25, "file": "A.java", "start": 6, "end": 10},
        ]
        fps = winnow(hashed, w=4)
        assert len(fps) >= 1
        selected_hashes = {fp["hash"] for fp in fps}
        assert 5 in selected_hashes

    def test_winnow_empty(self):
        assert winnow([]) == []


class TestIDFWeighting:
    def test_build_inverted_index(self):
        db = {
            "s1": [{"hash": 100}, {"hash": 200}],
            "s2": [{"hash": 200}, {"hash": 300}],
        }
        idx = build_inverted_index(db)
        assert idx[100] == {"s1"}
        assert idx[200] == {"s1", "s2"}
        assert idx[300] == {"s2"}

    def test_build_idf_weights(self):
        idx = {100: {"s1"}, 200: {"s1", "s2"}, 300: {"s2"}}
        weights = build_idf_weights(idx, 2)
        # Hash in 1 student should have higher weight than hash in 2 students
        assert weights[100] > weights[200]

    def test_weighted_jaccard(self):
        fps_a = [
            {"hash": 1, "file": "A.java", "start": 1, "end": 5},
            {"hash": 2, "file": "A.java", "start": 2, "end": 6},
        ]
        fps_b = [
            {"hash": 1, "file": "B.java", "start": 1, "end": 5},
            {"hash": 3, "file": "B.java", "start": 2, "end": 6},
        ]
        # With IDF weights where hash 1 is rare
        idf = {1: 1.0, 2: 0.5, 3: 0.5}
        score, _ = compare_fingerprints(fps_a, fps_b, idf_weights=idf)
        assert 0.0 < score < 1.0

    def test_unweighted_fallback(self):
        fps = [{"hash": 1, "file": "A.java", "start": 1, "end": 5}]
        score, _ = compare_fingerprints(fps, fps)  # no idf_weights
        assert score == 1.0


class TestCandidatePairs:
    def test_shared_hash_pairs(self):
        inverted = {
            100: {"s1", "s2"},
            200: {"s2", "s3"},
            300: {"s1"},
        }
        pairs = candidate_pairs_from_index(inverted)
        assert ("s1", "s2") in pairs
        assert ("s2", "s3") in pairs
        assert ("s1", "s3") not in pairs  # no shared hash

    def test_no_shared_hashes(self):
        inverted = {100: {"s1"}, 200: {"s2"}}
        pairs = candidate_pairs_from_index(inverted)
        assert len(pairs) == 0

    def test_all_share_hash(self):
        inverted = {100: {"s1", "s2", "s3"}}
        pairs = candidate_pairs_from_index(inverted)
        assert len(pairs) == 3  # C(3,2) = 3


class TestLookupSource:
    def test_exact_match(self):
        cache = {"s1": {"Main.java": "code"}}
        assert _lookup_source(cache, "s1", "Main.java") == "code"

    def test_suffix_match(self):
        cache = {"s1": {"src/Main.java": "code"}}
        assert _lookup_source(cache, "s1", "Main.java") == "code"

    def test_not_found(self):
        cache = {"s1": {}}
        assert _lookup_source(cache, "s1", "Missing.java") == "// File not found"

    def test_missing_student(self):
        cache = {}
        assert _lookup_source(cache, "s1", "Main.java") == "// File not found"


class TestCompareFingerprints:
    def test_identical(self):
        fps = [
            {"hash": 1, "file": "A.java", "start": 1, "end": 5},
            {"hash": 2, "file": "A.java", "start": 2, "end": 6},
            {"hash": 3, "file": "A.java", "start": 3, "end": 7},
        ]
        score, matches = compare_fingerprints(fps, fps)
        assert score == 1.0
        assert len(matches) > 0

    def test_completely_different(self):
        fps_a = [{"hash": 1, "file": "A.java", "start": 1, "end": 5}]
        fps_b = [{"hash": 999, "file": "B.java", "start": 1, "end": 5}]
        score, matches = compare_fingerprints(fps_a, fps_b)
        assert score == 0.0
        assert len(matches) == 0

    def test_partial_overlap(self):
        fps_a = [
            {"hash": 1, "file": "A.java", "start": 1, "end": 5},
            {"hash": 2, "file": "A.java", "start": 2, "end": 6},
        ]
        fps_b = [
            {"hash": 1, "file": "B.java", "start": 1, "end": 5},
            {"hash": 3, "file": "B.java", "start": 2, "end": 6},
        ]
        score, matches = compare_fingerprints(fps_a, fps_b)
        assert 0.0 < score < 1.0

    def test_empty_fingerprints(self):
        score, matches = compare_fingerprints([], [])
        assert score == 0.0
        assert len(matches) == 0


class TestGroupAndMerge:
    def test_merge_adjacent(self):
        matches = [
            {"hash": "1", "file_a": "A.java", "file_b": "B.java",
             "start_a": 1, "end_a": 3, "start_b": 1, "end_b": 3},
            {"hash": "2", "file_a": "A.java", "file_b": "B.java",
             "start_a": 4, "end_a": 6, "start_b": 4, "end_b": 6},
            {"hash": "3", "file_a": "A.java", "file_b": "B.java",
             "start_a": 7, "end_a": 9, "start_b": 7, "end_b": 9},
        ]
        blocks = group_and_merge_matches(matches, min_block_size=3)
        assert len(blocks) >= 1
        assert blocks[0]["start_a"] == 1
        assert blocks[0]["end_a"] == 9

    def test_non_adjacent(self):
        matches = [
            {"hash": "1", "file_a": "A.java", "file_b": "B.java",
             "start_a": 1, "end_a": 3, "start_b": 1, "end_b": 3},
            {"hash": "2", "file_a": "A.java", "file_b": "B.java",
             "start_a": 100, "end_a": 103, "start_b": 200, "end_b": 203},
        ]
        blocks = group_and_merge_matches(matches, min_block_size=3)
        assert len(blocks) == 2

    def test_empty(self):
        assert group_and_merge_matches([]) == []

    def test_below_min_block_filtered(self):
        matches = [
            {"hash": "1", "file_a": "A.java", "file_b": "B.java",
             "start_a": 1, "end_a": 1, "start_b": 1, "end_b": 1},
        ]
        blocks = group_and_merge_matches(matches, min_block_size=5)
        assert len(blocks) == 0

    def test_below_default_min_block_filtered(self):
        """Default min_block_size is now 3."""
        matches = [
            {"hash": "1", "file_a": "A.java", "file_b": "B.java",
             "start_a": 1, "end_a": 1, "start_b": 1, "end_b": 1},
        ]
        blocks = group_and_merge_matches(matches)
        assert len(blocks) == 0  # 1 line < 3 min


class TestProcessZipSubmission:
    def test_java_zip(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            zip_path = os.path.join(tmpdir, "student1.zip")
            with zipfile.ZipFile(zip_path, "w") as zf:
                zf.writestr("Main.java", JAVA_CODE_A)
            extract_root = os.path.join(tmpdir, "extracted")
            os.makedirs(extract_root)
            student_id, fps, k_map = process_zip_submission(zip_path, extract_root)
            assert student_id == "student1"
            assert isinstance(fps, list)
            assert len(fps) > 0
            assert isinstance(k_map, dict)

    def test_bad_zip(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            zip_path = os.path.join(tmpdir, "bad.zip")
            with open(zip_path, "w") as f:
                f.write("not a zip file")
            extract_root = os.path.join(tmpdir, "extracted")
            os.makedirs(extract_root)
            student_id, fps, k_map = process_zip_submission(zip_path, extract_root)
            assert student_id == "bad"
            assert fps == []
            assert k_map == {}

    def test_empty_zip(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            zip_path = os.path.join(tmpdir, "empty.zip")
            with zipfile.ZipFile(zip_path, "w"):
                pass
            extract_root = os.path.join(tmpdir, "extracted")
            os.makedirs(extract_root)
            student_id, fps, k_map = process_zip_submission(zip_path, extract_root)
            assert student_id == "empty"
            assert fps == []

    def test_nested_zip(self):
        import io
        with tempfile.TemporaryDirectory() as tmpdir:
            zip_path = os.path.join(tmpdir, "student2.zip")
            with zipfile.ZipFile(zip_path, "w") as outer:
                buf = io.BytesIO()
                with zipfile.ZipFile(buf, "w") as inner:
                    inner.writestr("Main.java", JAVA_CODE_A)
                outer.writestr("project.zip", buf.getvalue())
            extract_root = os.path.join(tmpdir, "extracted")
            os.makedirs(extract_root)
            student_id, fps, k_map = process_zip_submission(zip_path, extract_root)
            assert student_id == "student2"
            assert len(fps) > 0

    def test_nested_zip_with_macosx(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            zip_path = os.path.join(tmpdir, "stu3.zip")
            with zipfile.ZipFile(zip_path, "w") as zf:
                zf.writestr("Main.java", JAVA_CODE_B)
                zf.writestr("__MACOSX/._Main.java", "metadata")
            extract_root = os.path.join(tmpdir, "extracted")
            os.makedirs(extract_root)
            student_id, fps, k_map = process_zip_submission(zip_path, extract_root)
            assert student_id == "stu3"
            assert len(fps) > 0
            for root, dirs, _ in os.walk(os.path.join(extract_root, "stu3")):
                assert "__MACOSX" not in dirs


JAVA_CODE_A = """\
public class Solution {
    public static int add(int a, int b) {
        return a + b;
    }
    public static int multiply(int a, int b) {
        int result = 0;
        for (int i = 0; i < b; i++) {
            result = add(result, a);
        }
        return result;
    }
    public static void main(String[] args) {
        System.out.println(add(2, 3));
        System.out.println(multiply(4, 5));
    }
}
"""

JAVA_CODE_B = """\
public class Answer {
    public static int sum(int x, int y) {
        return x + y;
    }
    public static int product(int x, int y) {
        int res = 0;
        for (int j = 0; j < y; j++) {
            res = sum(res, x);
        }
        return res;
    }
    public static void main(String[] args) {
        System.out.println(sum(2, 3));
        System.out.println(product(4, 5));
    }
}
"""

JAVA_CODE_DIFFERENT = """\
public class Unrelated {
    public static String reverse(String s) {
        StringBuilder sb = new StringBuilder(s);
        return sb.reverse().toString();
    }
    public static boolean isPalindrome(String s) {
        return s.equals(reverse(s));
    }
}
"""


def _make_student_zip(directory, name, code):
    path = os.path.join(directory, f"{name}.zip")
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("Main.java", code)
    return path


class TestRunEngineWithReferences:
    def test_single_student_vs_references(self):
        with tempfile.TemporaryDirectory() as d:
            _make_student_zip(d, "student1", JAVA_CODE_A)
            _make_student_zip(d, "_ref_old1", JAVA_CODE_B)
            _make_student_zip(d, "_ref_old2", JAVA_CODE_A)

            result = run_engine(d, parallel=False)
            meta = result["metadata"]
            assert meta["total_students"] == 1
            assert meta["reference_submissions"] == 2
            assert meta["total_pairs_possible"] == 2
            assert meta["pairs_flagged"] >= 1

    def test_single_student_no_references(self):
        with tempfile.TemporaryDirectory() as d:
            _make_student_zip(d, "student1", JAVA_CODE_A)
            result = run_engine(d, parallel=False)
            meta = result["metadata"]
            assert meta["total_students"] == 1
            assert meta["reference_submissions"] == 0
            assert meta["pairs_flagged"] == 0

    def test_multiple_students_with_references(self):
        with tempfile.TemporaryDirectory() as d:
            _make_student_zip(d, "stu1", JAVA_CODE_A)
            _make_student_zip(d, "stu2", JAVA_CODE_B)
            _make_student_zip(d, "_ref_sol", JAVA_CODE_A)
            result = run_engine(d, parallel=False)
            meta = result["metadata"]
            assert meta["total_students"] == 2
            assert meta["reference_submissions"] == 1
            assert meta["total_pairs_possible"] == 3

    def test_no_ref_vs_ref(self):
        with tempfile.TemporaryDirectory() as d:
            _make_student_zip(d, "_ref_a", JAVA_CODE_A)
            _make_student_zip(d, "_ref_b", JAVA_CODE_A)
            result = run_engine(d, parallel=False)
            meta = result["metadata"]
            assert meta["total_students"] == 0
            assert meta["reference_submissions"] == 2
            assert meta["total_pairs_possible"] == 0
            assert meta["pairs_flagged"] == 0

    def test_different_code_not_flagged(self):
        with tempfile.TemporaryDirectory() as d:
            _make_student_zip(d, "stu1", JAVA_CODE_A)
            _make_student_zip(d, "stu2", JAVA_CODE_DIFFERENT)
            result = run_engine(d, parallel=False)
            for pair in result["pairs"]:
                assert pair["similarity"] < 0.8

    def test_custom_threshold(self):
        """Variable threshold is respected by the engine."""
        with tempfile.TemporaryDirectory() as d:
            _make_student_zip(d, "stu1", JAVA_CODE_A)
            _make_student_zip(d, "stu2", JAVA_CODE_B)

            low = run_engine(d, similarity_threshold=0.01, parallel=False)
            high = run_engine(d, similarity_threshold=0.99, parallel=False)

            assert high["metadata"]["pairs_flagged"] <= low["metadata"]["pairs_flagged"]
            assert low["metadata"]["similarity_threshold"] == 0.01
            assert high["metadata"]["similarity_threshold"] == 0.99
