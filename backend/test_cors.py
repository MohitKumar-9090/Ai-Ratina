"""
Test suite for verifying FastAPI CORS settings in RetinaAI backend.
Uses direct ASGI scope invocation so no extra HTTP client package dependencies are required.
"""

import asyncio
import unittest

from main import app


async def make_asgi_request(app, method: str, path: str, headers: dict = None):
    headers = headers or {}
    raw_headers = [
        (k.lower().encode("utf-8"), v.encode("utf-8"))
        for k, v in headers.items()
    ]
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.0"},
        "http_version": "1.1",
        "method": method.upper(),
        "path": path,
        "raw_path": path.encode("utf-8"),
        "query_string": b"",
        "headers": raw_headers,
        "client": ("127.0.0.1", 12345),
        "server": ("127.0.0.1", 80),
    }

    response_headers = {}
    status_code = None

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        nonlocal status_code, response_headers
        if message["type"] == "http.response.start":
            status_code = message["status"]
            for name, value in message.get("headers", []):
                response_headers[name.decode("utf-8").lower()] = value.decode("utf-8")

    await app(scope, receive, send)
    return status_code, response_headers


class TestCORSConfiguration(unittest.TestCase):

    def test_production_vercel_origin_health(self):
        origin = "https://ai-ratina.vercel.app"
        # Preflight
        status, headers = asyncio.run(
            make_asgi_request(
                app,
                "OPTIONS",
                "/api/health",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "GET",
                    "Access-Control-Request-Headers": "content-type",
                },
            )
        )
        self.assertEqual(headers.get("access-control-allow-origin"), origin)
        self.assertEqual(headers.get("access-control-allow-credentials"), "true")

        # GET Request
        status, headers = asyncio.run(
            make_asgi_request(app, "GET", "/api/health", headers={"Origin": origin})
        )
        self.assertEqual(status, 200)
        self.assertEqual(headers.get("access-control-allow-origin"), origin)
        self.assertEqual(headers.get("access-control-allow-credentials"), "true")

    def test_preview_vercel_origin_health(self):
        test_origins = [
            "https://ai-ratina-git-main-username.vercel.app",
            "https://ai-ratina-preview-1234.vercel.app",
            "https://ai-ratina-abc.vercel.app",
        ]

        for origin in test_origins:
            with self.subTest(origin=origin):
                # Preflight
                status, headers = asyncio.run(
                    make_asgi_request(
                        app,
                        "OPTIONS",
                        "/api/health",
                        headers={
                            "Origin": origin,
                            "Access-Control-Request-Method": "GET",
                        },
                    )
                )
                self.assertEqual(headers.get("access-control-allow-origin"), origin)
                self.assertEqual(headers.get("access-control-allow-credentials"), "true")

                # GET Request
                status, headers = asyncio.run(
                    make_asgi_request(app, "GET", "/api/health", headers={"Origin": origin})
                )
                self.assertEqual(status, 200)
                self.assertEqual(headers.get("access-control-allow-origin"), origin)

    def test_localhost_origins(self):
        localhost_origins = [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://localhost:5174",
        ]

        for origin in localhost_origins:
            with self.subTest(origin=origin):
                status, headers = asyncio.run(
                    make_asgi_request(app, "GET", "/api/health", headers={"Origin": origin})
                )
                self.assertEqual(status, 200)
                self.assertEqual(headers.get("access-control-allow-origin"), origin)

    def test_post_analyze_preflight_and_cors(self):
        origin = "https://ai-ratina.vercel.app"
        # Preflight for POST /api/analyze
        status, headers = asyncio.run(
            make_asgi_request(
                app,
                "OPTIONS",
                "/api/analyze",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "content-type",
                },
            )
        )
        self.assertEqual(headers.get("access-control-allow-origin"), origin)
        self.assertEqual(headers.get("access-control-allow-credentials"), "true")

        # Also test preview origin preflight for POST /api/analyze
        preview_origin = "https://ai-ratina-preview-xyz.vercel.app"
        status, headers = asyncio.run(
            make_asgi_request(
                app,
                "OPTIONS",
                "/api/analyze",
                headers={
                    "Origin": preview_origin,
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "content-type",
                },
            )
        )
        self.assertEqual(headers.get("access-control-allow-origin"), preview_origin)
        self.assertEqual(headers.get("access-control-allow-credentials"), "true")

    def test_unauthorized_origin_blocked(self):
        origin = "https://unauthorized-domain.com"
        status, headers = asyncio.run(
            make_asgi_request(app, "GET", "/api/health", headers={"Origin": origin})
        )
        self.assertIsNone(headers.get("access-control-allow-origin"))


if __name__ == "__main__":
    unittest.main()
