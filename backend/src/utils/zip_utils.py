"""Shared utilities for recursive ZIP extraction and cleanup."""

import os
import shutil
import zipfile


def resolve_nested_zips(directory: str, max_depth: int = 5) -> None:
    """Walk *directory*, extract any .zip files found in-place, remove them, recurse.

    Also removes ``__MACOSX`` directories and ``._`` prefixed files at every level.
    A *max_depth* guard prevents ZIP-bomb scenarios.
    """
    if max_depth <= 0:
        return

    cleanup_macosx(directory)

    # Collect ZIP files first (avoid mutating the tree while walking)
    zip_files: list[str] = []
    for root, _, files in os.walk(directory):
        for fname in files:
            if fname.lower().endswith(".zip"):
                zip_files.append(os.path.join(root, fname))

    for zip_path in zip_files:
        extract_dir = os.path.splitext(zip_path)[0]
        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(extract_dir)
        except (zipfile.BadZipFile, OSError):
            continue  # skip corrupt / unreadable ZIPs
        finally:
            # Always remove the ZIP after attempting extraction
            try:
                os.remove(zip_path)
            except OSError:
                pass

        # Recurse into the freshly extracted directory
        resolve_nested_zips(extract_dir, max_depth - 1)

    # Final cleanup pass
    cleanup_macosx(directory)


def extract_zip_recursive(zip_path: str, dest_dir: str, max_depth: int = 5) -> None:
    """Extract *zip_path* into *dest_dir*, then resolve any nested ZIPs."""
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(dest_dir)
    resolve_nested_zips(dest_dir, max_depth)


def cleanup_macosx(directory: str) -> None:
    """Remove ``__MACOSX`` directories and ``._`` prefixed files."""
    for root, dirs, files in os.walk(directory, topdown=False):
        for d in dirs:
            if d == "__MACOSX":
                shutil.rmtree(os.path.join(root, d), ignore_errors=True)
        for f in files:
            if f.startswith("._"):
                try:
                    os.remove(os.path.join(root, f))
                except OSError:
                    pass
