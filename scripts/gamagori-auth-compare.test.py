import base64
import importlib.util
import io
import json
from pathlib import Path
import unittest
import urllib.error

spec = importlib.util.spec_from_file_location("compare", Path(__file__).with_name("gamagori-auth-compare.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def jwt(role, ref=m.PROJECT):
    payload = base64.urlsafe_b64encode(json.dumps({"ref": ref, "role": role}).encode()).decode().rstrip("=")
    return "fixture." + payload + ".fixture"


class Opener:
    def __init__(self, status=200, body=b'{"external":{}}'):
        self.status, self.body, self.requests = status, body, []

    def open(self, req, timeout):
        self.requests.append(req)
        if self.status != 200:
            raise urllib.error.HTTPError(req.full_url, self.status, "fixture error", {}, io.BytesIO(b'{"message":"Invalid API key"}'))
        response = io.BytesIO(self.body)
        response.status = 200
        return response


class SecurityTests(unittest.TestCase):
    def keys(self):
        return {"legacy_anon": jwt("anon"), "legacy_service_role": jwt("service_role"),
                "modern_secret": "sb_secret_" + "fixture" * 8}

    def test_all_three_use_same_fixed_get_and_no_bearer(self):
        opener = Opener()
        report = m.compare(self.keys(), "baseline", opener=opener)
        self.assertTrue(report["baseline_complete"])
        self.assertEqual(len(opener.requests), 3)
        for request in opener.requests:
            self.assertEqual(request.full_url, m.ORIGIN + m.PATH)
            self.assertEqual(request.method, "GET")
            self.assertIsNone(request.get_header("Authorization"))
        self.assertFalse(report["revocation_verified"])

    def test_foreign_jwt_and_role_swap_never_send(self):
        opener = Opener()
        self.assertEqual(m.probe("legacy_anon", jwt("anon", "foreign"), opener)["outcome"], "invalid_input")
        self.assertEqual(m.probe("legacy_anon", jwt("service_role"), opener)["outcome"], "invalid_input")
        self.assertFalse(opener.requests)

    def test_no_redirect_following(self):
        self.assertIsNone(m.NoRedirect().redirect_request(None, None, 302, "", {}, "https://example.invalid"))
        self.assertEqual(m.probe("legacy_anon", jwt("anon"), Opener(302))["outcome"], "http_error")

    def test_report_never_contains_keys_or_body(self):
        keys = self.keys()
        report = json.dumps(m.compare(keys, "baseline", opener=Opener(body=b'{"external":{},"private":"NEVER_PRINT"}')))
        for key in keys.values():
            self.assertNotIn(key, report)
        self.assertNotIn("NEVER_PRINT", report)

    def test_missing_keys_and_server_errors_hold(self):
        self.assertEqual(m.compare({}, "baseline")["api_comparison"], "HOLD")
        self.assertEqual(m.compare(self.keys(), "baseline", opener=Opener(500))["api_comparison"], "HOLD")

    def test_invalid_json_or_unexpected_shape_is_not_success(self):
        for body in (b'not-json', b'{}', b'{"error":"fixture"}'):
            self.assertEqual(m.probe("legacy_anon", jwt("anon"), Opener(body=body))["outcome"], "unexpected_response")

    def test_generic_401_403_or_exception_cannot_prove_revocation(self):
        class Broken:
            def open(self, req, timeout):
                raise RuntimeError("DO_NOT_PRINT_HEADERS_OR_SECRETS")
        self.assertEqual(m.probe("legacy_anon", jwt("anon"), Broken())["outcome"], "transport_error")
        self.assertEqual(m.probe("legacy_anon", jwt("anon"), Opener(403))["outcome"], "http_error")
        class Generic401:
            def open(self, req, timeout):
                raise urllib.error.HTTPError(req.full_url, 401, "fixture", {}, io.BytesIO(b'{}'))
        self.assertEqual(m.probe("legacy_anon", jwt("anon"), Generic401())["outcome"], "http_error")

    def test_post_requires_valid_complete_baseline_and_modern_success(self):
        keys = self.keys()
        baseline = m.compare(keys, "baseline", opener=Opener())
        class PostOpener(Opener):
            def open(self, req, timeout):
                self.status = 200 if req.get_header("Apikey").startswith("sb_secret_") else 401
                return super().open(req, timeout)
        self.assertEqual(m.compare(keys, "post", baseline, PostOpener())["api_comparison"], "GO")
        self.assertEqual(m.compare(keys, "post", None, PostOpener())["api_comparison"], "HOLD")
        self.assertEqual(m.compare(keys, "post", baseline, Opener(401))["api_comparison"], "HOLD")
        changed = dict(keys)
        changed["modern_secret"] += "changed"
        self.assertEqual(m.compare(changed, "post", baseline, PostOpener())["api_comparison"], "HOLD")
        baseline["origin"] = "https://foreign.invalid"
        self.assertEqual(m.compare(keys, "post", baseline, PostOpener())["api_comparison"], "HOLD")


if __name__ == "__main__":
    unittest.main()
