"""Optional private directory for mutable cache/users; no implicit migration."""
import os
from pathlib import Path
import stat


def data_path(explicit, filename):
    """Explicit constructor paths win; unset env preserves historical CWD paths.

    An explicitly configured directory is authoritative. Operators must preload
    migrated state before first startup; this function never copies legacy data.
    """
    if explicit is not None:
        return explicit
    directory = os.environ.get('ESIEE_DATA_DIR')
    if directory is None:
        return filename
    if not directory or not os.path.isabs(directory):
        raise ValueError('ESIEE_DATA_DIR must be an absolute, nonempty path')
    root = Path(directory)
    if root.is_symlink():
        raise ValueError('ESIEE_DATA_DIR must not be a symlink')
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    info = root.stat()
    if not stat.S_ISDIR(info.st_mode) or stat.S_IMODE(info.st_mode) != 0o700:
        raise PermissionError('ESIEE_DATA_DIR must be a private directory (0700)')
    return str(root / filename)


def private_opener(path, flags):
    """New user files are private even with a permissive process umask."""
    return os.open(path, flags, 0o600)
