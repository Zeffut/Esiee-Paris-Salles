#!/usr/bin/env python3
"""Offline-only capture/install. Never stops services or overwrites a directory.

Quiescence is an operator assertion, not something this filesystem tool can
establish. Capture only after stopping the API's request AND background writers.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import tempfile

STATE = ('esiee_cache.json', 'esiee_users.json')
WHITELIST = 'email_whitelist.json'


def metadata(info):
    return {'uid': info.st_uid, 'gid': info.st_gid,
            'mode': stat.S_IMODE(info.st_mode), 'size': info.st_size,
            'mtime_ns': info.st_mtime_ns, 'ctime_ns': info.st_ctime_ns,
            'dev': info.st_dev, 'ino': info.st_ino}


def read_stable(path):
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode):
        raise ValueError(f'Not a regular file: {path.name}')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'rb') as stream:
        if metadata(os.fstat(stream.fileno())) != metadata(before):
            raise ValueError('Source replaced before read')
        content = stream.read()
        after = os.fstat(stream.fileno())
    if metadata(before) != metadata(after) or metadata(path.lstat()) != metadata(before):
        raise ValueError('Source changed during read')
    parsed = json.loads(content)
    if not isinstance(parsed, (dict, list)):
        raise ValueError('Expected JSON object/list')
    if path.name == 'esiee_users.json' and (not isinstance(parsed, dict) or
            any(not isinstance(parsed.get(key), dict) for key in ('users', 'sessions', 'metadata'))):
        raise ValueError('Invalid users structure; refusing silent account reset')
    if path.name == 'esiee_cache.json' and (not isinstance(parsed, dict) or
            not {'data', 'last_update'}.issubset(parsed)):
        raise ValueError('Invalid cache structure')
    return content, metadata(before)


def private_write(path, content, uid, gid):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(content)
        stream.flush()
        if (os.fstat(stream.fileno()).st_uid, os.fstat(stream.fileno()).st_gid) != (uid, gid):
            os.fchown(stream.fileno(), uid, gid)
        os.fchmod(stream.fileno(), 0o600)
        os.fsync(stream.fileno())


def sync_directory(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def transfer(source, destination, uid, gid, *, quiesced=False,
             include_whitelist=False, verified_snapshot=False):
    if not quiesced:
        raise ValueError('API quiescence acknowledgement required')
    source, destination = Path(source), Path(destination)
    if not source.is_absolute() or not destination.is_absolute():
        raise ValueError('Use absolute paths')
    if source.is_symlink() or not source.is_dir():
        raise ValueError('Source must be a real directory')
    if destination.exists() or destination.is_symlink():
        raise FileExistsError(destination)
    if uid < 0 or gid < 0:
        raise ValueError('Explicit nonnegative UID/GID required')
    names = STATE + ((WHITELIST,) if include_whitelist else ())
    payloads = {name: read_stable(source / name) for name in names}
    if verified_snapshot:
        manifest_bytes, _ = read_stable(source / 'manifest.json')
        manifest = json.loads(manifest_bytes)
        for name, (content, _) in payloads.items():
            if hashlib.sha256(content).hexdigest() != manifest['files'][name]['sha256']:
                raise ValueError('Snapshot hash mismatch')
    # Publish only complete private state. Parent must already exist on VPS.
    staging = Path(tempfile.mkdtemp(prefix='.esiee-migrate-', dir=destination.parent))
    try:
        receipt = {'version': 1, 'quiescence': 'operator_asserted', 'files': {}}
        for name, (content, source_meta) in payloads.items():
            target = staging / name
            private_write(target, content, uid, gid)
            readback, target_meta = read_stable(target)
            if readback != content or target_meta['mode'] != 0o600 or (target_meta['uid'], target_meta['gid']) != (uid, gid):
                raise ValueError('Target readback mismatch')
            receipt['files'][name] = {'sha256': hashlib.sha256(content).hexdigest(),
                                     'source': source_meta, 'target': target_meta}
        # Verify all source files again, not merely each file during its own read.
        for name, previous in payloads.items():
            if read_stable(source / name) != previous:
                raise ValueError('Source changed during capture')
        private_write(staging / 'manifest.json', (json.dumps(receipt, indent=2) + '\n').encode(), uid, gid)
        sync_directory(staging)
        if (staging.stat().st_uid, staging.stat().st_gid) != (uid, gid):
            os.chown(staging, uid, gid)
        # Parent must be private and controlled by the operator: no competing
        # publisher may create destination between this check and rename.
        if destination.exists() or destination.is_symlink():
            raise FileExistsError(destination)
        os.rename(staging, destination)
        sync_directory(destination.parent)
        return receipt
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['capture', 'install'])
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--destination', required=True, type=Path)
    parser.add_argument('--uid', required=True, type=int)
    parser.add_argument('--gid', required=True, type=int)
    parser.add_argument('--api-quiesced', action='store_true')
    parser.add_argument('--include-whitelist', action='store_true', help='capture original whitelist for backup only')
    args = parser.parse_args()
    if args.action == 'install' and args.include_whitelist:
        parser.error('install publishes cache/users only; whitelist contract is unchanged')
    transfer(args.source, args.destination, args.uid, args.gid,
             quiesced=args.api_quiesced, include_whitelist=args.include_whitelist,
             verified_snapshot=args.action == 'install')
    print(f'{args.action}: verified private snapshot published; inspect destination/manifest.json locally')


if __name__ == '__main__':
    main()
