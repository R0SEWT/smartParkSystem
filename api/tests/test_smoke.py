import os
import unittest


# Permite importar la app sin dependencias externas (Postgres/Mongo) en CI.
os.environ.setdefault("SMARTPARK_TESTING", "1")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:5173")


from app import app as flask_app


class SmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = flask_app.test_client()

    def test_healthz_ok(self):
        resp = self.client.get("/healthz")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json(), {"ok": True})
        self.assertTrue(resp.headers.get("X-Request-ID"))

    def test_openapi_json_has_paths(self):
        resp = self.client.get("/openapi.json")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data["openapi"].startswith("3"))
        self.assertIn("/healthz", data["paths"])
        self.assertIn("/registro_data", data["paths"])

    def test_docs_served(self):
        resp = self.client.get("/docs")
        self.assertEqual(resp.status_code, 200)
        body = resp.get_data(as_text=True)
        self.assertIn("SwaggerUIBundle", body)
        self.assertIn("/openapi.json", body)

    def test_registro_data_invalid_sensor_id_returns_400(self):
        resp = self.client.get("/registro_data?sensor_id=abc")
        self.assertEqual(resp.status_code, 400)
        data = resp.get_json()
        self.assertIs(data["ok"], False)

    def test_cors_preflight_allows_configured_origin(self):
        resp = self.client.open(
            "/healthz",
            method="OPTIONS",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Content-Type",
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173")
        self.assertEqual(resp.headers.get("Access-Control-Allow-Credentials"), "true")
        self.assertTrue(resp.headers.get("X-Request-ID"))

