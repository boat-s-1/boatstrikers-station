"""Run one approved official GET, under a persistent shared 48-attempt ledger."""
import argparse
import fcntl
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("url")
parser.add_argument("--approved-host", required=True)
parser.add_argument("--state", required=True, type=Path)
args = parser.parse_args()
url = urlsplit(args.url)
if (url.scheme != "https" or url.netloc != args.approved_host or url.fragment
        or url.username is not None or url.password is not None or url.port is not None):
    parser.error("Use an exact approved official HTTPS host without credentials, port or fragment")

args.state.mkdir(parents=True, exist_ok=True)
ledger = args.state / "get-continuation.jsonl"
with ledger.open("a+", encoding="utf-8") as entries:
    fcntl.flock(entries, fcntl.LOCK_EX)
    entries.seek(0)
    records = [json.loads(line) for line in entries]
    attempts = sum(record["event"] == "attempt" for record in records)
    if attempts >= 48:
        parser.error("The remaining 48-attempt budget is exhausted")
    if records and records[-1]["event"] != "result":
        parser.error("Previous attempt has no result. Reconcile the ledger before proceeding.")
    number = 3 + attempts

    def record(event, **details):
        import os
        entries.write(json.dumps({"event": event, "number": number,
            "utc": datetime.now(timezone.utc).isoformat(), **details}) + "\n")
        entries.flush()
        os.fsync(entries.fileno())

    record("attempt", url=args.url)
    prefix = args.state / f"official-{number:02}"
    result = subprocess.run(["curl", "--disable", "--silent", "--show-error",
        "--proto", "=https", "--retry", "0", "--connect-timeout", "6", "--max-time", "15",
        "--max-filesize", "4194304", "--max-redirs", "0", "--dump-header", str(prefix)+".headers",
        "--output", str(prefix)+".html", "--write-out",
        "%{http_code}\t%{time_namelookup}\t%{time_connect}\t%{time_appconnect}\t%{time_total}\t%{redirect_url}",
        "--", args.url], capture_output=True, text=True, check=False)
    record("result", exit_code=result.returncode, timings=result.stdout, error=result.stderr.strip())
    print(result.stdout)
    raise SystemExit(result.returncode)
