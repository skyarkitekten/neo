"""Tests for extension-manifest validation in scripts/validate-plugins.py.

Run from the repo root:
    python3 -m unittest discover -s scripts/tests -v
"""

from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

_SCRIPT = Path(__file__).resolve().parent.parent / "validate-plugins.py"
_spec = importlib.util.spec_from_file_location("validate_plugins", _SCRIPT)
vp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(vp)  # defines functions only; main() is not run


class ExtensionValidationTest(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name).resolve()
        self.plugin = self.root / "plugins" / "demo"
        self.plugin.mkdir(parents=True)
        # Isolate module-level state per test.
        vp.errors.clear()
        vp.warnings.clear()
        self.addCleanup(vp.errors.clear)
        self.addCleanup(vp.warnings.clear)

    def write_manifest(self, **extra: object) -> None:
        data = {"name": "demo", "version": "0.1.0", **extra}
        (self.plugin / "plugin.json").write_text(json.dumps(data), encoding="utf-8")

    def make_package(self, name: str = "pkg", with_module: bool = True) -> Path:
        pkg = self.plugin / "extensions" / name
        pkg.mkdir(parents=True)
        if with_module:
            (pkg / "extension.mjs").write_text("export default {};\n", encoding="utf-8")
        return pkg

    def extension_errors(self) -> list[str]:
        vp.errors.clear()
        vp.check_component_paths(self.plugin)
        return [e for e in vp.errors if "extension" in e]

    def test_valid_extension_directory(self) -> None:
        self.make_package()
        self.write_manifest(extensions="extensions/")
        self.assertEqual(self.extension_errors(), [])
        self.assertEqual(vp.warnings, [])

    def test_valid_extension_array(self) -> None:
        self.make_package()
        self.write_manifest(extensions=["extensions/"])
        self.assertEqual(self.extension_errors(), [])

    def test_undeclared_extensions_dir(self) -> None:
        self.make_package()
        self.write_manifest()
        errs = self.extension_errors()
        self.assertEqual(len(errs), 1)
        self.assertIn("declares no 'extensions' key", errs[0])

    def test_declared_missing_extension_module(self) -> None:
        self.make_package(with_module=False)
        self.write_manifest(extensions="extensions/")
        errs = self.extension_errors()
        self.assertEqual(len(errs), 1)
        self.assertIn("has no extension.mjs", errs[0])

    def test_declared_path_escapes_plugin_root(self) -> None:
        outside = self.root / "outside" / "pkg"
        outside.mkdir(parents=True)
        (outside / "extension.mjs").write_text("", encoding="utf-8")
        self.write_manifest(extensions="../../outside/")
        errs = self.extension_errors()
        self.assertEqual(len(errs), 1)
        self.assertIn("resolves outside", errs[0])

    def test_declared_extensions_dir_missing(self) -> None:
        self.write_manifest(extensions="extensions/")
        errs = self.extension_errors()
        self.assertEqual(len(errs), 1)
        self.assertIn("not a directory", errs[0])

    def test_marketplace_entry_extensions_rejected(self) -> None:
        self.write_manifest()
        marketplace = self.root / "marketplace.json"
        marketplace.write_text(
            json.dumps(
                {
                    "plugins": [
                        {
                            "name": "demo",
                            "source": "plugins/demo",
                            "version": "0.1.0",
                            "extensions": "extensions/",
                        }
                    ]
                }
            ),
            encoding="utf-8",
        )
        original_root = vp.REPO_ROOT
        vp.REPO_ROOT = self.root
        self.addCleanup(setattr, vp, "REPO_ROOT", original_root)
        vp.check_marketplace(marketplace)
        self.assertEqual(len(vp.errors), 1)
        self.assertIn("declares extensions", vp.errors[0])


if __name__ == "__main__":
    unittest.main()
