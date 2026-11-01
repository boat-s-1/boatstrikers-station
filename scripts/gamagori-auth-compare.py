#!/usr/bin/env python3
"""Fixed isolated GET probe. Keys stay in memory; output is a status-only report."""
import argparse
import base64
import datetime
import getpass
import hashlib
import json
import sys
import warnings
import urllib.error
import urllib.request

PROJECT = "rdqnqvafsponsoetnezv"
ORIGIN = "https://" + PROJECT + ".supabase.co"
PATH = "/auth/v1/settings"
KINDS = ("legacy_anon", "legacy_service_role", "modern_secret")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def valid_key(kind, key):
    if not isinstance(key, str) or not key or any(c.isspace() for c in key):
        return False
    if kind == "modern_secret":
        return key.startswith("sb_secret_") and len(key) > 24
    try:
        pieces = key.split(".")
        if len(pieces) != 3:
            return False
        payload = json.loads(base64.urlsafe_b64decode(pieces[1] + "=" * (-len(pieces[1]) % 4)))
        # Payload is only a local scope/type guard, NOT signature verification.
        return payload.get("ref") == PROJECT and payload.get("role") == kind.removeprefix("legacy_")
    except Exception:
        return False


def probe(kind, key, opener=None):
    if not valid_key(kind, key):
        return {"kind": kind, "status": None, "outcome": "invalid_input"}
    opener = opener or urllib.request.build_opener(NoRedirect())
    # No Bearer substitution, URL credentials, query credentials, or redirects.
    req = urllib.request.Request(ORIGIN + PATH, headers={
        "apikey": key, "Accept": "application/json", "Cache-Control": "no-store", "User-Agent": "BoatStrikers-Isolated-Auth-Audit/1.0"
    }, method="GET")
    try:
        with opener.open(req, timeout=12) as response:
            status = response.status
            body = response.read(1048577)
            try:
                parsed = json.loads(body)
                shape_ok = len(body) <= 1048576 and isinstance(parsed, dict) and isinstance(parsed.get("external"), dict)
            except Exception:
                shape_ok = False
            return {"kind": kind, "status": status, "outcome": "accepted" if status == 200 and shape_ok else "unexpected_response"}
    except urllib.error.HTTPError as error:
        status = error.code
        rejection = False
        try:
            raw = error.read(65537)
            parsed = json.loads(raw) if len(raw) <= 65536 else {}
            message = str(parsed.get("message", "")).lower() if isinstance(parsed, dict) else ""
            rejection = status == 401 and any(marker in message for marker in (
                "invalid api key", "legacy api keys are disabled", "legacy api keys disabled", "api key is disabled"))
        except Exception:
            pass
        error.close()
        return {"kind": kind, "status": status, "outcome": "rejected" if rejection else "http_error"}
    except Exception:
        # Never print exception text: it can contain headers, URLs or server data.
        return {"kind": kind, "status": None, "outcome": "transport_error"}


def compare(keys, phase, baseline=None, opener=None):
    rows = [probe(kind, keys[kind], opener) if keys.get(kind) else
            {"kind": kind, "status": None, "outcome": "not_tested"} for kind in KINDS]
    for row in rows:
        if valid_key(row["kind"], keys.get(row["kind"])):
            row["credential_fingerprint"] = hashlib.sha256(keys[row["kind"]].encode()).hexdigest()
    all_accepted = all(row["outcome"] == "accepted" for row in rows)
    prior_ok = bool(baseline and baseline.get("project_ref") == PROJECT and
                    baseline.get("origin") == ORIGIN and baseline.get("path") == PATH and
                    baseline.get("method") == "GET" and baseline.get("phase") == "baseline" and
                    baseline.get("baseline_complete") is True and
                    {r.get("kind") for r in baseline.get("results", [])} == set(KINDS) and
                    len(baseline.get("results", [])) == 3 and
                    all(r.get("status") == 200 and r.get("outcome") == "accepted" for r in baseline["results"]) and
                    all(any(prior.get("kind") == row["kind"] and
                                row.get("credential_fingerprint") is not None and
                                prior.get("credential_fingerprint") == row["credential_fingerprint"]
                            for prior in baseline["results"]) for row in rows))
    post_ok = phase == "post" and prior_ok and all(
        row["outcome"] == ("accepted" if row["kind"] == "modern_secret" else "rejected")
        for row in rows)
    return {"project_ref": PROJECT, "origin": ORIGIN, "path": PATH, "method": "GET",
            "phase": phase, "checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "results": rows, "baseline_complete": phase == "baseline" and all_accepted,
            "api_comparison": "GO" if (phase == "baseline" and all_accepted) or post_ok else "HOLD",
            "revocation_verified": False,
            "scope_note": "API-key gate only; signing-key revocation, Edge entry auth and production readiness are separate."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stdin", action="store_true", help="Read JSON key map from an existing secure pipe; never use secret CLI arguments")
    parser.add_argument("--phase", choices=("baseline", "post"), default="baseline")
    parser.add_argument("--baseline", help="Sanitized baseline JSON report, required for post comparison")
    args = parser.parse_args()
    try:
        if args.stdin:
            keys = json.loads(sys.stdin.readline(32769))
            if not isinstance(keys, dict) or set(keys) - set(KINDS):
                raise ValueError()
        else:
            if not sys.stdin.isatty():
                raise ValueError()
            warnings.simplefilter("error", getpass.GetPassWarning)
            keys = {kind: getpass.getpass(kind + ": ") for kind in KINDS}
        baseline = None
        if args.baseline:
            with open(args.baseline, encoding="utf-8") as handle:
                baseline = json.load(handle)
        report = compare(keys, args.phase, baseline)
        keys.clear()
        print(json.dumps(report, ensure_ascii=False))
        return 0 if report["api_comparison"] == "GO" else 2
    except Exception:
        print(json.dumps({"api_comparison": "HOLD", "error": "input_or_baseline_unavailable"}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
