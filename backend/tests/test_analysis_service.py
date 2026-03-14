"""Unit tests for the analysis orchestration service."""

import os
import tempfile
import zipfile

from src.services.analysis import _has_source_files, _process_ref_tree, _zip_folder


class TestHasSourceFiles:
    def test_java(self):
        with tempfile.TemporaryDirectory() as d:
            open(os.path.join(d, "Main.java"), "w").close()
            assert _has_source_files(d) is True

    def test_cpp(self):
        with tempfile.TemporaryDirectory() as d:
            open(os.path.join(d, "main.cpp"), "w").close()
            assert _has_source_files(d) is True

    def test_c_header(self):
        with tempfile.TemporaryDirectory() as d:
            open(os.path.join(d, "util.h"), "w").close()
            assert _has_source_files(d) is True

    def test_no_source(self):
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, "readme.txt"), "w") as f:
                f.write("nothing")
            assert _has_source_files(d) is False

    def test_empty_dir(self):
        with tempfile.TemporaryDirectory() as d:
            assert _has_source_files(d) is False

    def test_nested(self):
        with tempfile.TemporaryDirectory() as d:
            sub = os.path.join(d, "src")
            os.makedirs(sub)
            open(os.path.join(sub, "Solution.java"), "w").close()
            assert _has_source_files(d) is True


class TestZipFolder:
    def test_creates_valid_zip(self):
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, "source")
            os.makedirs(src)
            with open(os.path.join(src, "test.java"), "w") as f:
                f.write("class Test {}")

            dest = os.path.join(d, "output.zip")
            _zip_folder(src, dest)

            assert os.path.isfile(dest)
            with zipfile.ZipFile(dest, "r") as zf:
                assert "test.java" in zf.namelist()

    def test_preserves_subdirs(self):
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, "source", "pkg")
            os.makedirs(src)
            with open(os.path.join(src, "A.java"), "w") as f:
                f.write("class A {}")

            dest = os.path.join(d, "output.zip")
            _zip_folder(os.path.join(d, "source"), dest)

            with zipfile.ZipFile(dest, "r") as zf:
                names = zf.namelist()
                assert any("pkg" in n and "A.java" in n for n in names)


class TestProcessRefTree:
    def test_root_source_files(self):
        with tempfile.TemporaryDirectory() as d:
            extracted = os.path.join(d, "extracted")
            os.makedirs(extracted)
            with open(os.path.join(extracted, "Solution.java"), "w") as f:
                f.write("class Solution {}")
            output = os.path.join(d, "output")
            os.makedirs(output)

            _process_ref_tree(extracted, output, "ref1")

            files = os.listdir(output)
            assert any(f.startswith("_ref_") and f.endswith(".zip") for f in files)

    def test_folders_with_source(self):
        with tempfile.TemporaryDirectory() as d:
            extracted = os.path.join(d, "extracted")
            student = os.path.join(extracted, "student1")
            os.makedirs(student)
            with open(os.path.join(student, "Main.java"), "w") as f:
                f.write("class Main {}")
            output = os.path.join(d, "output")
            os.makedirs(output)

            _process_ref_tree(extracted, output, "ref1")

            files = os.listdir(output)
            assert any("_ref_student1" in f for f in files)

    def test_skips_macosx(self):
        with tempfile.TemporaryDirectory() as d:
            extracted = os.path.join(d, "extracted")
            macosx = os.path.join(extracted, "__MACOSX")
            os.makedirs(macosx)
            with open(os.path.join(macosx, "junk.java"), "w") as f:
                f.write("class Junk {}")
            output = os.path.join(d, "output")
            os.makedirs(output)

            _process_ref_tree(extracted, output, "ref1")

            assert len(os.listdir(output)) == 0

    def test_nested_zips(self):
        with tempfile.TemporaryDirectory() as d:
            extracted = os.path.join(d, "extracted")
            os.makedirs(extracted)
            inner_zip = os.path.join(extracted, "inner.zip")
            with zipfile.ZipFile(inner_zip, "w") as zf:
                zf.writestr("Solution.java", "class Solution {}")
            output = os.path.join(d, "output")
            os.makedirs(output)

            _process_ref_tree(extracted, output, "ref1")

            files = os.listdir(output)
            assert any("_ref_inner" in f for f in files)

    def test_mixed_structure(self):
        """Folder with both source dirs and nested zips."""
        with tempfile.TemporaryDirectory() as d:
            extracted = os.path.join(d, "extracted")
            os.makedirs(extracted)

            # A folder with source
            s1 = os.path.join(extracted, "sol1")
            os.makedirs(s1)
            with open(os.path.join(s1, "A.java"), "w") as f:
                f.write("class A {}")

            # A nested zip
            inner = os.path.join(extracted, "sol2.zip")
            with zipfile.ZipFile(inner, "w") as zf:
                zf.writestr("B.java", "class B {}")

            output = os.path.join(d, "output")
            os.makedirs(output)

            _process_ref_tree(extracted, output, "ref1")

            files = os.listdir(output)
            assert len(files) >= 2
