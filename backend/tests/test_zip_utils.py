"""Unit tests for the shared ZIP utility module."""

import os
import tempfile
import zipfile

from src.utils.zip_utils import cleanup_macosx, extract_zip_recursive, resolve_nested_zips


class TestResolveNestedZips:
    def test_single_level(self):
        with tempfile.TemporaryDirectory() as d:
            # Create a ZIP inside the directory
            inner_zip = os.path.join(d, "inner.zip")
            with zipfile.ZipFile(inner_zip, "w") as zf:
                zf.writestr("Main.java", "class Main {}")

            resolve_nested_zips(d)

            # ZIP should be gone, Main.java should exist in "inner/" subdir
            assert not os.path.exists(inner_zip)
            assert os.path.isfile(os.path.join(d, "inner", "Main.java"))

    def test_two_levels(self):
        with tempfile.TemporaryDirectory() as d:
            # Create inner.zip containing innermost.zip containing a file
            innermost_path = os.path.join(d, "innermost.zip")
            with zipfile.ZipFile(innermost_path, "w") as zf:
                zf.writestr("Deep.java", "class Deep {}")

            inner_path = os.path.join(d, "outer.zip")
            with zipfile.ZipFile(inner_path, "w") as zf:
                zf.write(innermost_path, "innermost.zip")
            os.remove(innermost_path)

            resolve_nested_zips(d)

            # Both ZIPs should be extracted
            assert not os.path.exists(inner_path)
            # Deep.java should be reachable somewhere under d
            found = False
            for root, _, files in os.walk(d):
                if "Deep.java" in files:
                    found = True
                    break
            assert found

    def test_max_depth_protection(self):
        with tempfile.TemporaryDirectory() as d:
            # Create a self-referencing-like deeply nested ZIP chain
            current = os.path.join(d, "level3.zip")
            with zipfile.ZipFile(current, "w") as zf:
                zf.writestr("Bottom.java", "class Bottom {}")

            for i in range(2, 0, -1):
                outer = os.path.join(d, f"level{i}.zip")
                with zipfile.ZipFile(outer, "w") as zf:
                    zf.write(current, os.path.basename(current))
                os.remove(current)
                current = outer

            # With max_depth=1, only the first level should be extracted
            resolve_nested_zips(d, max_depth=1)

            # The outer ZIP should be extracted but inner ZIPs remain
            assert not os.path.exists(os.path.join(d, "level1.zip"))

    def test_removes_macosx(self):
        with tempfile.TemporaryDirectory() as d:
            inner_zip = os.path.join(d, "sub.zip")
            with zipfile.ZipFile(inner_zip, "w") as zf:
                zf.writestr("Main.java", "class Main {}")
                zf.writestr("__MACOSX/._Main.java", "junk")

            resolve_nested_zips(d)

            # __MACOSX should be cleaned up
            for root, dirs, _ in os.walk(d):
                assert "__MACOSX" not in dirs

    def test_empty_directory(self):
        with tempfile.TemporaryDirectory() as d:
            resolve_nested_zips(d)  # should not crash

    def test_corrupt_zip_skipped(self):
        with tempfile.TemporaryDirectory() as d:
            bad_zip = os.path.join(d, "corrupt.zip")
            with open(bad_zip, "w") as f:
                f.write("not a zip")

            resolve_nested_zips(d)  # should not crash
            # Corrupt ZIP is removed
            assert not os.path.exists(bad_zip)


class TestExtractZipRecursive:
    def test_basic(self):
        with tempfile.TemporaryDirectory() as d:
            zip_path = os.path.join(d, "submission.zip")
            with zipfile.ZipFile(zip_path, "w") as zf:
                zf.writestr("Main.java", "class Main {}")
                zf.writestr("Helper.java", "class Helper {}")

            dest = os.path.join(d, "output")
            os.makedirs(dest)
            extract_zip_recursive(zip_path, dest)

            assert os.path.isfile(os.path.join(dest, "Main.java"))
            assert os.path.isfile(os.path.join(dest, "Helper.java"))

    def test_with_nested_zip(self):
        with tempfile.TemporaryDirectory() as d:
            zip_path = os.path.join(d, "submission.zip")
            with zipfile.ZipFile(zip_path, "w") as outer:
                # Create an inner ZIP in memory
                import io
                buf = io.BytesIO()
                with zipfile.ZipFile(buf, "w") as inner:
                    inner.writestr("Nested.java", "class Nested {}")
                outer.writestr("inner.zip", buf.getvalue())
                outer.writestr("Top.java", "class Top {}")

            dest = os.path.join(d, "output")
            os.makedirs(dest)
            extract_zip_recursive(zip_path, dest)

            assert os.path.isfile(os.path.join(dest, "Top.java"))
            # Nested.java should be somewhere under dest
            found = any(
                "Nested.java" in files
                for _, _, files in os.walk(dest)
            )
            assert found


class TestCleanupMacosx:
    def test_removes_macosx_dir(self):
        with tempfile.TemporaryDirectory() as d:
            macosx = os.path.join(d, "__MACOSX")
            os.makedirs(macosx)
            with open(os.path.join(macosx, "._file"), "w") as f:
                f.write("junk")

            cleanup_macosx(d)

            assert not os.path.exists(macosx)

    def test_removes_dot_underscore_files(self):
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, "._hidden"), "w") as f:
                f.write("junk")
            with open(os.path.join(d, "Main.java"), "w") as f:
                f.write("class Main {}")

            cleanup_macosx(d)

            assert not os.path.exists(os.path.join(d, "._hidden"))
            assert os.path.exists(os.path.join(d, "Main.java"))

    def test_nested_macosx(self):
        with tempfile.TemporaryDirectory() as d:
            nested = os.path.join(d, "sub", "__MACOSX")
            os.makedirs(nested)
            with open(os.path.join(nested, "junk"), "w") as f:
                f.write("junk")

            cleanup_macosx(d)

            assert not os.path.exists(nested)
