"""Sequential official pilot. Response bodies are temporary and never exported."""
import hashlib
from html.parser import HTMLParser
import json
from datetime import datetime, timezone
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlsplit
from zoneinfo import ZoneInfo

JST = ZoneInfo("Asia/Tokyo")
NATIONAL = "https://www.boatrace.jp"
VENUE = "https://www.boatrace-tokoname.jp"
METRICS = ("一周", "まわり足", "直線", "半周")


class Page(HTMLParser):
    def __init__(self, body):
        super().__init__()
        self.links = []
        self.parts = []
        self.anchor = None
        self.feed(body)

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.anchor = [dict(attrs).get("href", ""), ""]

    def handle_endtag(self, tag):
        if tag == "a" and self.anchor is not None:
            self.links.append(self.anchor)
            self.anchor = None

    def handle_data(self, data):
        text = data.strip()
        if text:
            self.parts.append(text)
            if self.anchor is not None:
                self.anchor[1] += text


def current_race(page, day):
    for href, label in page.links:
        u = urlsplit(href)
        q = parse_qs(u.query)
        if (label == "出走表" and not u.netloc and u.path == "/owpc/pc/race/racelist"
                and q.get("hd") == [day] and q.get("jcd") == ["08"]
                and re.fullmatch(r"(?:[1-9]|1[0-2])", q.get("rno", [""])[0])):
            return int(q["rno"][0])
    return None


def deadline_from_roster(page, race):
    for i, label in enumerate(page.parts):
        if label == "締切予定時刻":
            times = page.parts[i+1:i+13]
            if len(times) == 12 and all(re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", time) for time in times):
                return times[race-1]
    return None


def venue_link(page, base):
    candidates = set()
    for href, label in page.links:
        if not re.search("直前情報|オリジナル展示|オリ展", label):
            continue
        u = urlsplit(urljoin(base, href))
        if (u.scheme == "https" and u.netloc == "www.boatrace-tokoname.jp"
                and not u.fragment and not u.username and not u.query
                and re.fullmatch(r"/[A-Za-z0-9_./~-]+", u.path)
                and u.path != urlsplit(base).path):
            candidates.add(u.geturl())
    return next(iter(candidates)) if len(candidates) == 1 else None


def main():
    public = Path(sys.argv[1])
    public.mkdir(parents=True, exist_ok=True)
    day = sys.argv[2]
    ledger = public / "get-continuation.jsonl"
    if ledger.exists() or day != datetime.now(JST).strftime("%Y%m%d"):
        raise SystemExit("ledger exists or JST date mismatch")
    count = 0

    def emit(event, **data):
        record = {"event": event, "utc": datetime.now(timezone.utc).isoformat(), **data}
        with ledger.open("a", encoding="utf-8") as out:
            out.write(json.dumps(record, ensure_ascii=False) + "\n")
        print(json.dumps(record, ensure_ascii=False), flush=True)

    emit("checkpoint", prior_run=46120677074, prior_last_number=4, remaining=46)

    def fetch(url):
        nonlocal count
        if count >= 1 or datetime.now(JST).strftime("%Y%m%d") != day:
            raise RuntimeError("budget_or_date_stop")
        u = urlsplit(url)
        if u.scheme != "https" or u.netloc not in {"www.boatrace.jp","www.boatrace-tokoname.jp"}:
            raise RuntimeError("origin_stop")
        count += 1
        number = 4 + count
        emit("attempt", number=number, source=u.netloc, path=u.path)
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp) / "body"
            result = subprocess.run(["curl","--disable","--silent","--proto","=https",
                "--retry","0","--max-redirs","0","--connect-timeout","6","--max-time","18",
                "--max-filesize","4194304","--output",str(raw),"--write-out",
                "%{http_code} %{time_namelookup} %{time_connect} %{time_appconnect} %{time_total}",
                "--",url],capture_output=True,check=False,text=True)
            values = result.stdout.split()
            metrics = values if len(values)==5 and all(re.fullmatch(r"\d+(?:\.\d+)?",x) for x in values) else []
            body = raw.read_bytes() if raw.exists() else b""
            emit("result", number=number, exit_code=result.returncode,
                 http=int(metrics[0]) if metrics else None, seconds=metrics[1:],
                 sha256=hashlib.sha256(body).hexdigest() if body else None, bytes=len(body))
            if result.returncode or not metrics or metrics[0] != "200" or not body:
                raise RuntimeError("official_fetch_failed")
            for encoding in ("utf-8","cp932"):
                try:
                    return Page(body.decode(encoding))
                except UnicodeDecodeError:
                    pass
            raise RuntimeError("encoding_unconfirmed")

    status = "unverified"
    try:
        index = fetch(f"{NATIONAL}/owpc/pc/race/index")
        date_confirmed = any(
            label == "更新" and urlsplit(href).path == "/owpc/pc/race/index"
            and parse_qs(urlsplit(href).query).get("hd") == [day]
            for href, label in index.links
        )
        if not date_confirmed:
            raise RuntimeError("response_date_unconfirmed")
        status = "index_date_confirmed"
        emit("observation", status=status, date=day, tokoname_link_race=current_race(index, day))
    except RuntimeError as error:
        emit("stop", reason=str(error))
        return 1
    finally:
        emit("summary", used=count, remaining=46-count, status=status)
    return 0


if __name__ == "__main__":
    sys.exit(main())
