#!/usr/bin/env python3
"""Extract the unmodified catalog-captured bootstrap RPC for disposable CI only."""
from pathlib import Path
import re

root = Path(__file__).resolve().parent
source = (root / "SIX-TABLE-ISOLATION-CANDIDATE.sql").read_text()
pattern = re.compile(
    r"(CREATE OR REPLACE FUNCTION public\.bs_apply_openapi_bootstrap\("
    r"p_events jsonb, p_entries jsonb, p_synced_at timestamp with time zone DEFAULT now\(\)\)"
    r".*?AS \$function\$.*?\$function\$;?)",
    re.DOTALL,
)
matches = pattern.findall(source)
if len(matches) != 1:
    raise SystemExit(f"Expected one captured bootstrap RPC, found {len(matches)}")
target = Path("/tmp/pr298-captured-bootstrap.sql")
target.write_text(matches[0] + "\n")
print(f"Extracted catalog-captured bootstrap RPC to {target}")
