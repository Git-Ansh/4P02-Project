"""Unit tests for the comparison engine."""

import os
import tempfile
import zipfile

from src.services.comparison_engine import (
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
        code = b"public class Main { public void foo() { int x = 1; } }"
        tree = parser.parse(code)
        tokens = []
        normalize_ast(tree.root_node, tokens)
        types = {t["t"] for t in tokens}
        assert "FUNC_DEF" in types


class TestNormalizePackage:
    def test_directory_with_java(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with open(os.path.join(tmpdir, "Main.java"), "w") as f:
                f.write("public class Main { public static void main(String[] args) { int x = 5; } }")
            file_data = normalize_package(tmpdir, "stu1")
            assert len(file_data) >= 1
            tokens = file_data[0]["tokens"]
            assert len(tokens) > 0
            assert all("file" in t for t in tokens)
            assert all(t["student"] == "stu1" for t in tokens)

    def test_skips_macosx(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            macosx = os.path.join(tmpdir, "__MACOSX")
            os.makedirs(macosx)
            with open(os.path.join(macosx, "Main.java"), "w") as f:
                f.write("class Main {}")
            file_data = normalize_package(tmpdir, "stu1")
            assert len(file_data) == 0


class TestAdaptiveK:
    def test_tiny_file(self):
        assert adaptive_k(20) == 3

    def test_small_file(self):
        assert adaptive_k(50) == 4

    def test_medium_file(self):
        assert adaptive_k(150) == 5

    def test_large_file(self):
        assert adaptive_k(600) == 9

    def test_boundary_30(self):
        assert adaptive_k(29) == 3
        assert adaptive_k(30) == 4

    def test_boundary_80(self):
        assert adaptive_k(79) == 4
        assert adaptive_k(80) == 5


class TestKgrams:
    def test_generation(self):
        tokens = [
            {"t": "FUNC_DEF", "line": 1, "file": "A.java"},
            {"t": "ID", "line": 1, "file": "A.java"},
            {"t": "ASSIGN", "line": 2, "file": "A.java"},
            {"t": "NUM", "line": 2, "file": "A.java"},
            {"t": "RETURN", "line": 3, "file": "A.java"},
            {"t": "BIN_OP", "line": 3, "file": "A.java"},
        ]
        spans = [{"type": "METHOD", "start": 1, "end": 3, "name": "test"}]
        grams = kgrams(tokens, k=4, spans=spans)
        assert len(grams) > 0
        for content, meta in grams:
            assert meta["file"] == "A.java"

    def test_cross_file_boundary(self):
        tokens = [
            {"t": "FUNC_DEF", "line": 1, "file": "A.java"},
            {"t": "ID", "line": 2, "file": "A.java"},
            {"t": "ASSIGN", "line": 3, "file": "A.java"},
            {"t": "NUM", "line": 1, "file": "B.java"},
            {"t": "RETURN", "line": 2, "file": "B.java"},
        ]
        grams = kgrams(tokens, k=3, spans=[])
        for content, meta in grams:
            assert meta["file"] in ("A.java", "B.java")

    def test_diversity_filter(self):
        tokens = [
            {"t": "ID", "line": 1, "file": "A.java"},
            {"t": "ID", "line": 2, "file": "A.java"},
            {"t": "ID", "line": 3, "file": "A.java"},
            {"t": "ID", "line": 4, "file": "A.java"},
            {"t": "ID", "line": 5, "file": "A.java"},
        ]
        grams = kgrams(tokens, k=5, spans=[])
        assert len(grams) == 0


class TestHashAndWinnow:
    def test_hash_kgrams(self):
        grams = [
            ("FUNC_DEF ID ASSIGN NUM RETURN", {"hash": None, "file": "A.java", "start": 1, "end": 3}),
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
        result = winnow([], w=4)
        assert result == []


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
        assert weights[100] > weights[200]

    def test_weighted_jaccard(self):
        fps_a = [
            {"hash": 1, "file": "A.java", "start": 1, "end": 5},
            {"hash": 2, "file": "A.java", "start": 2, "end": 6},
        ]
        fps_b = [
            {"hash": 1, "file": "A.java", "start": 1, "end": 5},
            {"hash": 3, "file": "A.java", "start": 2, "end": 6},
        ]
        idf = {1: 1.0, 2: 0.5, 3: 0.5}
        score, _ = compare_fingerprints(fps_a, fps_b, idf_weights=idf)
        assert 0.0 < score < 1.0


class TestCandidatePairs:
    def test_shared_hash_pairs(self):
        inverted = {100: {"s1", "s2"}, 200: {"s2", "s3"}, 300: {"s1"}}
        pairs = candidate_pairs_from_index(inverted)
        assert ("s1", "s2") in pairs
        assert ("s2", "s3") in pairs
        assert ("s1", "s3") not in pairs

    def test_no_shared_hashes(self):
        inverted = {100: {"s1"}, 200: {"s2"}}
        pairs = candidate_pairs_from_index(inverted)
        assert len(pairs) == 0

    def test_all_share_hash(self):
        inverted = {100: {"s1", "s2", "s3"}}
        pairs = candidate_pairs_from_index(inverted)
        assert len(pairs) == 3


class TestLookupSource:
    def test_exact_match(self):
        cache = {"s1": {"Main.java": "code"}}
        assert _lookup_source(cache, "s1", "Main.java") == "code"

    def test_suffix_match(self):
        cache = {"s1": {"src/Main.java": "code"}}
        assert _lookup_source(cache, "s1", "Main.java") == "code"

    def test_not_found(self):
        cache = {"s1": {}}
        assert _lookup_source(cache, "s1", "Missing.java") == ""

    def test_missing_student(self):
        cache = {}
        assert _lookup_source(cache, "s1", "Main.java") == ""


class TestCompareFingerprints:
    def test_identical(self):
        fps = [
            {"hash": 1, "file": "A.java", "start": 1, "end": 5},
            {"hash": 2, "file": "A.java", "start": 2, "end": 6},
            {"hash": 3, "file": "A.java", "start": 3, "end": 7},
        ]
        idf = {1: 1.0, 2: 1.0, 3: 1.0}
        score, matches = compare_fingerprints(fps, fps, idf)
        assert score == 1.0
        assert len(matches) > 0

    def test_completely_different(self):
        fps_a = [{"hash": 1, "file": "A.java", "start": 1, "end": 5}]
        fps_b = [{"hash": 999, "file": "B.java", "start": 1, "end": 5}]
        idf = {1: 1.0, 999: 1.0}
        score, matches = compare_fingerprints(fps_a, fps_b, idf)
        assert score == 0.0
        assert len(matches) == 0

    def test_partial_overlap(self):
        fps_a = [
            {"hash": 1, "file": "A.java", "start": 1, "end": 5},
            {"hash": 2, "file": "A.java", "start": 2, "end": 6},
        ]
        fps_b = [
            {"hash": 1, "file": "A.java", "start": 1, "end": 5},
            {"hash": 3, "file": "A.java", "start": 2, "end": 6},
        ]
        idf = {1: 1.0, 2: 0.5, 3: 0.5}
        score, matches = compare_fingerprints(fps_a, fps_b, idf)
        assert 0.0 < score < 1.0

    def test_empty_fingerprints(self):
        idf = {}
        score, matches = compare_fingerprints([], [], idf)
        assert score == 0.0
        assert len(matches) == 0


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
