"""Unit tests for the comparison engine (AST tokenizer, k-gram, winnowing, Jaccard)."""

import os
import tempfile
import zipfile

from src.services.comparison_engine import (
    K_GRAM_SIZE,
    compare_fingerprints,
    get_parser,
    group_and_merge_matches,
    hash_kgrams,
    kgrams,
    normalize_ast,
    normalize_package,
    process_zip_submission,
    winnow,
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
            tokens = normalize_package(tmpdir, "stu1")
            assert len(tokens) > 0
            assert all("file" in t for t in tokens)
            assert all(t["student"] == "stu1" for t in tokens)

    def test_skips_macosx(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            macosx = os.path.join(tmpdir, "__MACOSX")
            os.makedirs(macosx)
            with open(os.path.join(macosx, "Main.java"), "w") as f:
                f.write("class Main {}")
            tokens = normalize_package(tmpdir, "stu1")
            assert len(tokens) == 0


class TestKgrams:
    def test_generation(self):
        tokens = [
            {"t": "CLASS", "line": 1, "file": "A.java"},
            {"t": "ID", "line": 1, "file": "A.java"},
            {"t": "FUNC_DEF", "line": 2, "file": "A.java"},
            {"t": "ID", "line": 2, "file": "A.java"},
            {"t": "ASSIGN", "line": 3, "file": "A.java"},
            {"t": "ID", "line": 3, "file": "A.java"},
            {"t": "NUM", "line": 3, "file": "A.java"},
        ]
        grams = kgrams(tokens, k=K_GRAM_SIZE)
        assert len(grams) == len(tokens) - K_GRAM_SIZE + 1
        for content, meta in grams:
            assert meta["file"] == "A.java"

    def test_cross_file_boundary(self):
        tokens = [
            {"t": "ID", "line": 1, "file": "A.java"},
            {"t": "ID", "line": 2, "file": "A.java"},
            {"t": "ID", "line": 3, "file": "A.java"},
            {"t": "ID", "line": 1, "file": "B.java"},
            {"t": "ID", "line": 2, "file": "B.java"},
        ]
        grams = kgrams(tokens, k=3)
        # Grams spanning A.java -> B.java should be skipped
        for content, meta in grams:
            assert meta["file"] in ("A.java", "B.java")


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
        # The minimum hash (5) should always be selected
        selected_hashes = {fp["hash"] for fp in fps}
        assert 5 in selected_hashes

    def test_winnow_empty(self):
        assert winnow([]) == []


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
        blocks = group_and_merge_matches(matches, min_block_size=3)
        assert len(blocks) == 0


class TestProcessZipSubmission:
    def test_java_zip(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            zip_path = os.path.join(tmpdir, "student1.zip")
            with zipfile.ZipFile(zip_path, "w") as zf:
                zf.writestr(
                    "Main.java",
                    'public class Main { public static void main(String[] args) { System.out.println("Hello"); } }',
                )
            extract_root = os.path.join(tmpdir, "extracted")
            os.makedirs(extract_root)
            student_id, fps = process_zip_submission(zip_path, extract_root)
            assert student_id == "student1"
            assert isinstance(fps, list)
            assert len(fps) > 0

    def test_bad_zip(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            zip_path = os.path.join(tmpdir, "bad.zip")
            with open(zip_path, "w") as f:
                f.write("not a zip file")
            extract_root = os.path.join(tmpdir, "extracted")
            os.makedirs(extract_root)
            student_id, fps = process_zip_submission(zip_path, extract_root)
            assert student_id == "bad"
            assert fps == []

    def test_empty_zip(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            zip_path = os.path.join(tmpdir, "empty.zip")
            with zipfile.ZipFile(zip_path, "w"):
                pass  # empty zip
            extract_root = os.path.join(tmpdir, "extracted")
            os.makedirs(extract_root)
            student_id, fps = process_zip_submission(zip_path, extract_root)
            assert student_id == "empty"
            assert fps == []
