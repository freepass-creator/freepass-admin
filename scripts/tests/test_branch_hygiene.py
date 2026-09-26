import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('branch_hygiene', ROOT / 'scripts/branch_hygiene.py')
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)
SHA = 'a' * 40


def candidate(branch='work/test', mode='merged'):
    item = {'branch': branch, 'expected_sha': SHA, 'mode': mode}
    if mode == 'archive':
        item['archive_tag'] = 'archive/admin-main-20260926/' + branch
    return item


class SafetyTests(unittest.TestCase):
    def test_protect_main(self):
        with self.assertRaises(ValueError):
            h.decision(candidate('main'), SHA, set(), True)

    def test_reject_invalid_sha(self):
        item = candidate()
        item['expected_sha'] = 'HEAD'
        with self.assertRaises(ValueError):
            h.decision(item, 'HEAD', set(), True)

    def test_reject_unknown_mode(self):
        with self.assertRaises(ValueError):
            h.decision(candidate(mode='force'), SHA, set(), True)

    def test_missing_is_noop(self):
        self.assertEqual(h.decision(candidate(), None, set(), True), 'MISSING')

    def test_advanced_branch_is_never_reset(self):
        self.assertEqual(h.decision(candidate(), 'b' * 40, set(), True), 'SKIP_ADVANCED')

    def test_open_pr_is_protected(self):
        self.assertEqual(h.decision(candidate(), SHA, {'work/test'}, True), 'SKIP_ACTIVE_OR_OPEN_PR')

    def test_unmerged_branch_is_protected(self):
        self.assertEqual(h.decision(candidate(), SHA, set(), False), 'SKIP_UNMERGED')

    def test_merged_branch_is_retired(self):
        self.assertEqual(h.decision(candidate(), SHA, set(), True), 'DELETE')

    def test_archive_requires_branch_specific_tag(self):
        item = candidate(mode='archive')
        item['archive_tag'] = 'main'
        with self.assertRaises(ValueError):
            h.decision(item, SHA, set(), False)

    def test_divergent_retirement_preserves_history(self):
        self.assertEqual(h.decision(candidate(mode='archive'), SHA, set(), False), 'ARCHIVE_THEN_DELETE')

    def test_manifest_is_explicit_and_complete(self):
        manifest = json.loads((ROOT / 'registry/branch-retirement-20260926.json').read_text())
        items = manifest['candidates']
        self.assertEqual(len(items), 9)
        self.assertEqual(len({item['branch'] for item in items}), 9)
        for item in items:
            h.decision(item, item['expected_sha'], set(), item['mode'] == 'merged')
            self.assertTrue(item['reason'])

    def test_single_writer_governance_is_preserved(self):
        active = json.loads((ROOT / 'registry/active-work.json').read_text())
        self.assertEqual(active['coordination']['mode'], 'UNIFIED_MAIN_SINGLE_WRITER')
        self.assertEqual(active['coordination']['max_concurrent_writers'], 1)
        self.assertFalse(active['coordination']['permanent_lane_branches'])
        self.assertIsInstance(active['active'], list)
        self.assertEqual(active['branch_creation']['default'], 'REQUIRES_SINGLE_WORK_ORDER_AND_WRITER')
        self.assertEqual(active['branch_retirement']['work_order_issue'], 134)


class LocalRemoteTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.remote = self.root / 'origin.git'
        self.work = self.root / 'work'
        self.work.mkdir()
        self.run_git('init', '--bare', str(self.remote))
        self.run_git('init', '-b', 'main')
        self.run_git('config', 'user.name', 'Test')
        self.run_git('config', 'user.email', 'test@example.invalid')
        self.run_git('commit', '--allow-empty', '-m', 'base')
        self.sha = self.run_git('rev-parse', 'HEAD')
        self.run_git('remote', 'add', 'origin', str(self.remote))
        self.run_git('push', 'origin', 'main', 'HEAD:refs/heads/work/test')
        outer = self
        class LocalGit(h.Git):
            def run(self, *args):
                return outer.run_git(*args)
        self.git = LocalGit()
        self.item = {'branch': 'work/test', 'expected_sha': self.sha, 'mode': 'archive',
                     'archive_tag': 'archive/admin-main-20260926/work/test'}

    def run_git(self, *args):
        return subprocess.run(['git', *args], cwd=self.work, text=True, capture_output=True,
                              check=True, timeout=20).stdout.strip()

    def tearDown(self):
        self.temp.cleanup()

    def test_archive_then_delete_keeps_exact_commit(self):
        self.git.archive(self.item)
        self.git.delete(self.item)
        self.assertNotIn('work/test', self.git.heads())
        self.assertEqual(self.git.heads()['main'], self.sha)
        archived = self.run_git('ls-remote', '--refs', 'origin', 'refs/tags/' + self.item['archive_tag'])
        self.assertEqual(archived.split()[0], self.sha)

    def test_concurrent_push_is_protected_by_lease(self):
        self.run_git('commit', '--allow-empty', '-m', 'concurrent writer')
        newer = self.run_git('rev-parse', 'HEAD')
        self.run_git('push', 'origin', 'HEAD:refs/heads/work/test')
        with self.assertRaises(subprocess.CalledProcessError):
            self.git.delete(self.item)
        self.assertEqual(self.git.heads()['work/test'], newer)

    def test_conflicting_archive_prevents_retirement(self):
        self.run_git('commit', '--allow-empty', '-m', 'other history')
        self.run_git('push', 'origin', 'HEAD:refs/tags/' + self.item['archive_tag'])
        with self.assertRaises(RuntimeError):
            self.git.archive(self.item)
        self.assertEqual(self.git.heads()['work/test'], self.sha)

    def test_existing_correct_archive_is_idempotent(self):
        self.git.archive(self.item)
        self.git.archive(self.item)
        self.assertEqual(self.git.heads()['work/test'], self.sha)


if __name__ == '__main__':
    unittest.main()
