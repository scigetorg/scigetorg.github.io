from __future__ import annotations

import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / ".github"
    / "workflows"
    / "write-user-metrics.py"
)
SPEC = importlib.util.spec_from_file_location("write_user_metrics", SCRIPT_PATH)
assert SPEC and SPEC.loader
write_user_metrics = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(write_user_metrics)


CATALOG = {
    "apps": [
        {"id": "musclemap", "path": "musclemap", "title": "MuscleMap", "users": 120},
        {"id": "seedseg", "path": "seedseg", "title": "SeedSeg", "users": 15},
        {"id": "new-tool", "path": "new-tool", "title": "New tool", "users": 0},
    ]
}


def matches(expression: dict, host: str, path: str) -> bool:
    if "orGroup" in expression:
        return any(matches(item, host, path) for item in expression["orGroup"]["expressions"])
    if "andGroup" in expression:
        return all(matches(item, host, path) for item in expression["andGroup"]["expressions"])
    rule = expression["filter"]
    value = {"hostName": host, "pagePath": path}[rule["fieldName"]]
    expected = rule["stringFilter"]["value"]
    if not rule["stringFilter"]["caseSensitive"]:
        value, expected = value.lower(), expected.lower()
    if rule["stringFilter"]["matchType"] == "EXACT":
        return value == expected
    if rule["stringFilter"]["matchType"] == "ENDS_WITH":
        return value.endswith(expected)
    assert rule["stringFilter"]["matchType"] == "BEGINS_WITH"
    return value.startswith(expected)


class BuildMetricsTests(unittest.TestCase):
    def test_default_output_targets_astro_public_directory(self) -> None:
        with mock.patch("sys.argv", ["write-user-metrics.py"]):
            args = write_user_metrics.parse_args()

        self.assertEqual(args.output, "public/data/user-metrics.json")

    def test_summarize_tracking_start_uses_first_reported_date(self) -> None:
        rows = [
            {"dimensionValues": [{"value": "20260714"}]},
            {"dimensionValues": [{"value": "20260715"}]},
        ]

        self.assertEqual(
            write_user_metrics.summarize_tracking_start(rows),
            "2026-07-14",
        )

    def test_summarize_tracking_start_returns_none_for_empty_rows(self) -> None:
        self.assertIsNone(write_user_metrics.summarize_tracking_start([]))

    def test_users_to_date_uses_all_time_total_users(self) -> None:
        def fake_run_report(
            token: str,
            property_id: str,
            body: dict,
            start_date: str = write_user_metrics.EARLIEST_START_DATE,
            end_date: str = "today",
        ) -> list[dict]:
            del token, property_id, end_date
            metric_names = [metric["name"] for metric in body.get("metrics", [])]
            dimension_names = [
                dimension["name"] for dimension in body.get("dimensions", [])
            ]

            if metric_names == ["newUsers"] and dimension_names == ["yearMonth"]:
                return [
                    {
                        "dimensionValues": [{"value": "202607"}],
                        "metricValues": [{"value": "35"}],
                    }
                ]

            if metric_names == ["totalUsers"] and dimension_names == [
                "countryId",
                "country",
            ]:
                return []

            if (
                metric_names == ["totalUsers"]
                and start_date == write_user_metrics.EARLIEST_START_DATE
            ):
                return [{"metricValues": [{"value": "75"}]}]

            if metric_names == ["totalUsers", "sessions", "screenPageViews"]:
                return [
                    {
                        "metricValues": [
                            {"value": "60"},
                            {"value": "103"},
                            {"value": "250"},
                        ]
                    }
                ]

            self.fail(
                f"Unexpected report: metrics={metric_names}, "
                f"dimensions={dimension_names}, start_date={start_date}"
            )

        with mock.patch.object(
            write_user_metrics, "run_report", side_effect=fake_run_report
        ):
            metrics = write_user_metrics.build_metrics("token", "property", 30)

        self.assertEqual(metrics["totalUsers"], 75)
        self.assertEqual(metrics["periodUsers"], 60)
        self.assertEqual(metrics["months"][0]["newUsers"], 35)
        self.assertEqual(metrics["months"][0]["cumulativeUsers"], 35)


class ScigetWebappMetricsTests(unittest.TestCase):
    SINGLE_CATALOG = [
        {
            "id": "msk",
            "label": "Musculoskeletal",
            "host": "mskapps.sciget.org",
            "url": "https://mskapps.sciget.org/analytics.json",
        }
    ]

    def load_catalog(self, catalog=CATALOG):
        with (
            mock.patch.object(write_user_metrics, "WEBAPP_CATALOGS", self.SINGLE_CATALOG),
            mock.patch.object(write_user_metrics.requests, "get") as get,
        ):
            get.return_value.json.return_value = catalog
            segments = write_user_metrics.load_webapp_segments()
        get.assert_called_once_with("https://mskapps.sciget.org/analytics.json", timeout=60)
        return segments

    def test_catalog_includes_new_and_zero_usage_apps_with_canonical_ids(self) -> None:
        segments = self.load_catalog()
        self.assertEqual(
            [s["id"] for s in segments],
            ["webapp-msk-musclemap", "webapp-msk-seedseg", "webapp-msk-new-tool"],
        )
        self.assertEqual(segments[0]["url"], "https://mskapps.sciget.org/musclemap/")
        self.assertEqual(segments[0]["name"], "MuscleMap")

    def test_filter_matches_catalog_host_and_paths_without_neighbor_apps(self) -> None:
        for segment in self.load_catalog():
            slug = segment["id"].removeprefix("webapp-msk-")
            expression = write_user_metrics.dimension_filter_for_segment(segment)
            for path in ["/" + slug, "/" + slug + "/", "/" + slug + "/results/index.html"]:
                self.assertTrue(matches(expression, "mskapps.sciget.org", path))
                self.assertFalse(matches(expression, "microscopyapps.sciget.org", path))
                self.assertFalse(matches(expression, "unrelated.org", path))
            for path in ["/", "/" + slug + "-other/", "/other/" + slug]:
                self.assertFalse(matches(expression, "mskapps.sciget.org", path))

    def test_site_totals_count_only_sciget_production_hosts(self) -> None:
        expression = write_user_metrics.production_hosts_filter()
        for host in [
            "sciget.org",
            "www.sciget.org",
            "webapps.sciget.org",
            "mskapps.sciget.org",
            "microscopyapps.sciget.org",
            "play-australia.sciget.org",
            "scigetorg.github.io",
        ]:
            self.assertTrue(matches(expression, host, "/"), host)
        for host in [
            "127.0.0.1",
            "localhost",
            "neurodesk.org",
            "someone.github.io",
            "notsciget.org",
            "sciget.org.example.com",
        ]:
            self.assertFalse(matches(expression, host, "/"), host)

    def test_invalid_catalog_fails_instead_of_publishing_partial_list(self) -> None:
        for catalog in [
            {},
            {"apps": []},
            {"apps": [None]},
            {"apps": [{"title": "Tool", "path": "../tool"}]},
            {"apps": [{"title": "Tool", "path": "/tool"}]},
            {"apps": [{"title": "", "path": "tool"}]},
            {"apps": [CATALOG["apps"][0], CATALOG["apps"][0]]},
        ]:
            with self.subTest(catalog=catalog), self.assertRaises(ValueError):
                self.load_catalog(catalog)

    def test_placeholder_does_not_fetch_catalog(self) -> None:
        args = SimpleNamespace(property_id="", output="unused", period_days=30, allow_missing_token=True)
        with (
            mock.patch.dict(os.environ, {write_user_metrics.GA4_SERVICE_ACCOUNT_KEY_ENV: ""}),
            mock.patch.object(write_user_metrics, "parse_args", return_value=args),
            mock.patch.object(write_user_metrics, "write_json"),
            mock.patch.object(write_user_metrics.requests, "get") as get,
        ):
            self.assertEqual(write_user_metrics.main(), 0)
        get.assert_not_called()

    def test_period_countries_use_sciget_production_hosts(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "metrics.json"
            args = SimpleNamespace(property_id="123", output=str(output), period_days=30, allow_missing_token=False)
            site_filter = write_user_metrics.production_hosts_filter()

            def report(token, property_id, body, start_date=write_user_metrics.EARLIEST_START_DATE, end_date="today"):
                del token, property_id, end_date
                dimensions = [dimension["name"] for dimension in body.get("dimensions", [])]
                if dimensions != ["countryId", "country"] or body.get("dimensionFilter") != site_filter:
                    return []
                users = "12" if start_date == "30daysAgo" else "900"
                return [{"dimensionValues": [{"value": "AU"}, {"value": "Australia"}], "metricValues": [{"value": users}]}]

            with (
                mock.patch.dict(os.environ, {write_user_metrics.GA4_SERVICE_ACCOUNT_KEY_ENV: "{}"}),
                mock.patch.object(write_user_metrics, "parse_args", return_value=args),
                mock.patch.object(write_user_metrics, "get_access_token", return_value="token"),
                mock.patch.object(write_user_metrics, "load_webapp_segments", return_value=[]),
                mock.patch.object(write_user_metrics, "run_report", side_effect=report),
            ):
                self.assertEqual(write_user_metrics.main(), 0)
            data = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(data["periodCountries"], [{"code": "AU", "name": "Australia", "users": 12}])
        self.assertEqual(data["countries"], [{"code": "AU", "name": "Australia", "users": 900}])


if __name__ == "__main__":
    unittest.main()
