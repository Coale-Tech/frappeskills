#!/usr/bin/env python3
"""
Frappe v15/v16/16.51 Compatibility Validation Script

Flags v15/v16 hazards and APIs removed or deprecated in 16.51.1 / ERPNext 16.50.0.
Run after generating code to check for compatibility issues.
"""

import re
import sys
from pathlib import Path
from typing import List, Tuple, Dict

# Version-specific patterns to check. frappe.xcall/frappe.call and the
# Workspace DocType all predate v16 (workspace.json creation: 2020-01-23) —
# only WorkspaceSidebar (creation: 2025-08-12) is actually v16-exclusive.
V16_ONLY_PATTERNS = [
    (r'WorkspaceSidebar', 'WorkspaceSidebar is v16 only'),
]

# Not version-gated — frappe.call({...}) still works in Desk client scripts
# on both v15 and v16. This only flags it as a style preference in SPA
# sources, where createResource (frappe-ui) is the current convention.
SPA_STYLE_PATTERNS = [
    (r'frappe\.call\(\s*{', 'frappe.call() with a dict is the legacy pattern; prefer createResource from frappe-ui in SPA code'),
]

SHARED_PATTERNS = [
    (r'@frappe\.whitelist\(\)', 'Correct: @frappe.whitelist() works in both versions'),
    (r'frappe\.get_doc\(', 'Correct: frappe.get_doc() works in both versions'),
    (r'frappe\.get_all\(', 'Correct: frappe.get_all() works in both versions'),
    (r'frappe\.db\.', 'Correct: frappe.db.* works in both versions'),
    (r'createResource', 'Correct: createResource from frappe-ui is version-agnostic'),
]

FRAPPE_UI_PATTERNS = [
    (r'from [\'"]frappe-ui[\'"]', 'Correct: Importing from frappe-ui'),
    (r'createResource', 'Correct: Using createResource for API calls'),
]

FIXTURE_PATTERNS = [
    (r'frappe\.db\.exists\([\'"]Custom Field[\'"]', 'Checking for Custom Field existence (good)'),
    (r'frappe\.new_doc\([\'"]Custom Field[\'"]', 'Creating Custom Field via code'),
    (r'get_custom_fields\(\)', 'Fixture pattern detected'),
]

# Hazards introduced between frappe 16.35.0 and 16.51.1 / erpnext 16.6.1 → 16.50.0.
# Each entry: (pattern, frozenset of file suffixes or None for all, level, message)
# Source-verified: 16.51.1 bench (16.51.1/16.50.0/16.50.0) vs coale_v16 (16.35.0/16.6.1/16.4.1).
V16_51_HAZARD_PATTERNS: List[Tuple] = [
    # mask_field_value no longer re-exported from db_query in 16.51
    (r'from frappe\.model\.db_query import mask_field_value',
     frozenset({'.py'}), 'error',
     'mask_field_value removed from frappe.model.db_query in 16.51+; import from frappe.model.utils.mask'),
    # frappe.utils.weasyprint still exists as a shim but prefer print_format_generator
    (r'from frappe\.utils\.weasyprint import',
     frozenset({'.py'}), 'warn',
     'frappe.utils.weasyprint is a forwarding shim in 16.51+; prefer frappe.utils.print_format_generator'),
    # ERPNext 16.50: BOM scrap_items table renamed to secondary_items
    (r'\bBOMScrapItem\b',
     frozenset({'.py'}), 'warn',
     'ERPNext 16.50: BOMScrapItem renamed BOMSecondaryItem; field scrap_items → secondary_items'),
    # HRMS 16.50: Upload Attendance DocType deleted (patch delete_upload_attendance_doctype)
    (r'"Upload Attendance"',
     frozenset({'.py'}), 'warn',
     'HRMS 16.50: Upload Attendance DocType deleted; use Employee Attendance Tool'),
    # CRM 2.x: WhatsApp Message renamed to WA Message (new whatsapp app)
    (r'"WhatsApp Message"',
     frozenset({'.py'}), 'warn',
     'CRM 2.x: WhatsApp Message doctype renamed WA Message; frappe_whatsapp → whatsapp app'),
    # JS/Vue: frappe.breadcrumbs.clear/toggle deprecated in 16.51
    (r'frappe\.breadcrumbs\.(clear|toggle)\(',
     frozenset({'.js', '.vue', '.ts'}), 'warn',
     'frappe.breadcrumbs.clear/toggle deprecated in 16.51; use page.set_breadcrumbs([]) or page.show_breadcrumbs = false'),
    # JS/Vue: frappe.boot.user.all_reports deprecated in 16.51
    (r'frappe\.boot\.user\.all_reports\b',
     frozenset({'.js', '.vue', '.ts'}), 'warn',
     'frappe.boot.user.all_reports deprecated in 16.51; use frappe.boot.allowed_reports'),
    # Any file: workspace_sidebar/ fixture directory removed in 16.51
    (r'workspace_sidebar/',
     None, 'warn',
     'workspace_sidebar/ fixture dir removed in 16.51; run bench --site <site> convert-sidebar-fixtures'),
]

class CompatibilityValidator:
    def __init__(self, root_path: str):
        self.root_path = Path(root_path)
        self.errors: List[Tuple[str, int, str]] = []
        self.warnings: List[Tuple[str, int, str]] = []
        self.success: List[Tuple[str, int, str]] = []

    def validate_file(self, file_path: Path) -> None:
        """Validate a single file for compatibility issues."""
        if not file_path.exists():
            self.errors.append((str(file_path), 0, f"File not found: {file_path}"))
            return

        try:
            content = file_path.read_text()
            lines = content.split('\n')

            # Check for v16-only patterns
            for pattern, message in V16_ONLY_PATTERNS:
                for match in re.finditer(pattern, content):
                    line_num = content[:match.start()].count('\n') + 1
                    self.errors.append((
                        str(file_path),
                        line_num,
                        f"v16 only: {message}"
                    ))

            # Style preference, not a version-compatibility issue: flag
            # frappe.call({...}) only in SPA sources, where createResource
            # is the current convention.
            is_spa_source = any(
                part in ("frontend", "src", "src2") for part in file_path.parts
            ) or file_path.suffix in (".vue", ".ts")
            if is_spa_source:
                for pattern, message in SPA_STYLE_PATTERNS:
                    for match in re.finditer(pattern, content):
                        line_num = content[:match.start()].count('\n') + 1
                        self.warnings.append((
                            str(file_path),
                            line_num,
                            f"style: {message}"
                        ))

            # Check for shared patterns (good)
            for pattern, message in SHARED_PATTERNS:
                if re.search(pattern, content):
                    self.success.append((
                        str(file_path),
                        0,
                        message
                    ))

            # Check for frappe-ui usage
            for pattern, message in FRAPPE_UI_PATTERNS:
                if re.search(pattern, content):
                    self.success.append((
                        str(file_path),
                        0,
                        message
                    ))
            # Check for 16.51 hazard patterns (errors/warnings by file type)
            for pattern, suffixes, level, message in V16_51_HAZARD_PATTERNS:
                if suffixes is None or file_path.suffix in suffixes:
                    for match in re.finditer(pattern, content):
                        line_num = content[:match.start()].count('\n') + 1
                        entry = (str(file_path), line_num, f'16.51: {message}')
                        if level == 'error':
                            self.errors.append(entry)
                        else:
                            self.warnings.append(entry)

        except Exception as e:
            self.errors.append((str(file_path), 0, f"Error reading file: {e}"))

    def validate_directory(self, directory: Path, extensions: List[str] = None) -> None:
        """Validate all files in a directory."""
        if extensions is None:
            extensions = ['.py', '.vue', '.js']

        for file_path in directory.rglob('*'):
            if file_path.is_file() and file_path.suffix in extensions:
                self.validate_file(file_path)

    def report(self) -> str:
        """Generate a compatibility report."""
        report_lines = [
            "=" * 60,
            "Frappe v15/v16/16.51 Compatibility Report",
            "=" * 60,
            ""
        ]

        if self.errors:
            report_lines.append(f"ERRORS ({len(self.errors)}):")
            report_lines.append("-" * 60)
            for file_path, line_num, message in self.errors:
                line_info = f":{line_num}" if line_num > 0 else ""
                report_lines.append(f"  {file_path}{line_info}")
                report_lines.append(f"    {message}")
            report_lines.append("")

        if self.warnings:
            report_lines.append(f"WARNINGS ({len(self.warnings)}):")
            report_lines.append("-" * 60)
            for file_path, line_num, message in self.warnings:
                line_info = f":{line_num}" if line_num > 0 else ""
                report_lines.append(f"  {file_path}{line_info}")
                report_lines.append(f"    {message}")
            report_lines.append("")

        # Summary of good patterns found
        good_patterns = {}
        for file_path, _, message in self.success:
            if message not in good_patterns:
                good_patterns[message] = []
            good_patterns[message].append(file_path)

        if good_patterns:
            report_lines.append(f"COMPATIBLE PATTERNS ({len(self.success)}):")
            report_lines.append("-" * 60)
            for pattern, files in good_patterns.items():
                report_lines.append(f"  {pattern} ({len(files)} files)")
            report_lines.append("")

        # Final summary
        report_lines.extend([
            "=" * 60,
            "SUMMARY",
            "=" * 60,
            f"Errors: {len(self.errors)}",
            f"Warnings: {len(self.warnings)}",
            f"Compatible patterns found: {len(self.success)}",
            ""
        ])

        if self.errors:
            report_lines.append("Result: FAILED - Please fix errors before deployment")
            return_code = 1
        elif self.warnings:
            report_lines.append("Result: PASSED with warnings - Review recommended")
            return_code = 0
        else:
            report_lines.append("Result: PASSED - Code is v15/v16 compatible")
            return_code = 0

        return "\n".join(report_lines), return_code

def main():
    """Main entry point for the validation script."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Validate Frappe v15/v16 compatibility"
    )
    parser.add_argument(
        'path',
        nargs='?',
        default='.',
        help='Path to validate (file or directory)'
    )
    parser.add_argument(
        '--extensions',
        nargs='+',
        default=['.py', '.vue', '.js'],
        help='File extensions to validate'
    )

    args = parser.parse_args()
    path = Path(args.path)

    validator = CompatibilityValidator(str(path))

    if path.is_file():
        validator.validate_file(path)
    else:
        validator.validate_directory(path, args.extensions)

    report, return_code = validator.report()
    print(report)

    sys.exit(return_code)

if __name__ == '__main__':
    main()
