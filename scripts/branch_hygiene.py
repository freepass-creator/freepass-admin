"""Retire only reviewed, exact-SHA branches; never rewrite a working branch."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.request

REPOSITORY = 'freepass-creator/freepass-admin'
ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'registry/branch-retirement-20260926.json'


def decision(item, current, open_heads, is_ancestor):
    branch, expected = item['branch'], item['expected_sha']
    if branch == 'main' or not re.fullmatch(r'[0-9a-f]{40}', expected):
        raise ValueError('Invalid or protected retirement candidate')
    mode = item['mode']
    if mode not in ('merged', 'archive'):
        raise ValueError('Unknown retirement mode')
    if mode == 'archive' and item.get('archive_tag') != 'archive/admin-main-20260926/' + branch:
        raise ValueError('Retired divergent history requires its own immutable archive tag')
    if current is None:
        return 'MISSING'
    if current != expected:
        return 'SKIP_ADVANCED'
    if branch in open_heads:
        return 'SKIP_ACTIVE_OR_OPEN_PR'
    if mode == 'merged' and not is_ancestor:
        return 'SKIP_UNMERGED'
    return 'ARCHIVE_THEN_DELETE' if mode == 'archive' else 'DELETE'


class Git:
    def run(self, *args):
        return subprocess.run(['git', *args], check=True, text=True,
                              capture_output=True, timeout=120).stdout.strip()

    def heads(self):
        return {ref.removeprefix('refs/heads/'): sha
                for sha, ref in (line.split() for line in self.run('ls-remote', '--heads', 'origin').splitlines())}

    def ancestor(self, sha):
        result = subprocess.run(['git', 'merge-base', '--is-ancestor', sha, 'refs/remotes/origin/main'],
                                capture_output=True, timeout=30)
        if result.returncode not in (0, 1):
            raise RuntimeError('Ancestry could not be verified')
        return result.returncode == 0

    def archive(self, item):
        ref = 'refs/tags/' + item['archive_tag']
        self.run('check-ref-format', ref)
        existing = self.run('ls-remote', '--refs', 'origin', ref)
        if existing:
            if existing.split()[0] != item['expected_sha']:
                raise RuntimeError('Archive tag conflict; refusing deletion')
        else:
            self.run('push', 'origin', item['expected_sha'] + ':' + ref)
        # Confirm the recoverable reference before removing a divergent branch.
        verified = self.run('ls-remote', '--refs', 'origin', ref)
        if not verified or verified.split()[0] != item['expected_sha']:
            raise RuntimeError('Archive could not be verified; refusing deletion')

    def delete(self, item):
        ref = 'refs/heads/' + item['branch']
        self.run('push', '--force-with-lease=' + ref + ':' + item['expected_sha'], 'origin', ':' + ref)


def open_heads(token):
    heads, page = set(), 1
    while True:
        req = urllib.request.Request(
            f'https://api.github.com/repos/{REPOSITORY}/pulls?state=open&per_page=100&page={page}',
            headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json',
                     'User-Agent': 'freepass-admin-branch-hygiene'})
        with urllib.request.urlopen(req, timeout=30) as response:
            pulls = json.load(response)
        if not isinstance(pulls, list):
            raise RuntimeError('Cannot verify open pull requests')
        for pr in pulls:
            head = pr['head']
            if (head.get('repo') or {}).get('full_name') == REPOSITORY:
                heads.add(head['ref'])
        if len(pulls) < 100:
            return heads
        page += 1


def execute(items, git, opened, apply=False):
    heads = git.heads()
    plans, seen = [], set()
    # Validate every candidate before the first write.
    for item in items:
        branch = item['branch']
        if branch in seen:
            raise ValueError('Duplicate retirement candidate')
        seen.add(branch)
        git.run('check-ref-format', 'refs/heads/' + branch)
        current = heads.get(branch)
        ancestor = git.ancestor(current) if current == item['expected_sha'] else False
        plans.append((item, decision(item, current, opened, ancestor)))
    for item, action in plans:
        print(json.dumps({'branch': item['branch'], 'expected_sha': item['expected_sha'],
                          'action': action, 'apply': apply}, ensure_ascii=False), flush=True)
        if apply and action in ('DELETE', 'ARCHIVE_THEN_DELETE'):
            if action == 'ARCHIVE_THEN_DELETE':
                git.archive(item)
            git.delete(item)
    return plans


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Apply a same-repository merged-PR cleanup')
    args = parser.parse_args()
    if os.environ.get('GITHUB_REPOSITORY') != REPOSITORY:
        raise RuntimeError('Unexpected repository; refusing cleanup')
    token = os.environ.get('GH_TOKEN')
    if not token:
        raise RuntimeError('Authenticated PR lookup is required, even for dry runs')
    items = json.loads(MANIFEST.read_text())['candidates']
    if args.apply:
        event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
        pr = event.get('pull_request') or {}
        head = pr.get('head') or {}
        if (os.environ.get('GITHUB_EVENT_NAME') != 'pull_request' or event.get('action') != 'closed'
                or pr.get('merged') is not True or (head.get('repo') or {}).get('full_name') != REPOSITORY
                or (pr.get('base') or {}).get('ref') != 'main' or head.get('ref') == 'main'):
            raise RuntimeError('Cleanup requires a merged same-repository pull request into main')
        if head['ref'] not in {item['branch'] for item in items}:
            items.append({'branch': head['ref'], 'expected_sha': head['sha'], 'mode': 'merged'})
    git = Git()
    git.run('fetch', '--prune', 'origin', '+refs/heads/*:refs/remotes/origin/*')
    active = json.loads((ROOT / 'registry/active-work.json').read_text())['active']
    protected = open_heads(token) | {item['branch'] for item in active}
    execute(items, git, protected, args.apply)


if __name__ == '__main__':
    main()
