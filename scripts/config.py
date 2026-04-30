"""Tiny .env loader. No third-party deps."""
import os
from pathlib import Path

_ENV_FILE = Path(__file__).parent.parent / ".env"


def load_env() -> dict[str, str]:
    """Read .env from repo root (if present). Returns dict, also injects into os.environ."""
    values: dict[str, str] = {}
    if not _ENV_FILE.exists():
        return values
    for raw in _ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        values[key] = val
        os.environ.setdefault(key, val)
    return values


def get(key: str, default: str = "") -> str:
    """Get a config value, loading .env on first call."""
    if key not in os.environ:
        load_env()
    return os.environ.get(key, default)
