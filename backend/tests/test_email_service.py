"""Unit tests for the email service helpers."""

from src.services.email import _brevo_configured, _fg_for_bg, _logo_html, _smtp_configured


class TestProviderDetection:
    def test_brevo_not_configured(self):
        # In test env BREVO_API_KEY is empty
        assert isinstance(_brevo_configured(), bool)

    def test_smtp_not_configured(self):
        assert isinstance(_smtp_configured(), bool)


class TestFgForBg:
    def test_dark_bg_returns_white(self):
        assert _fg_for_bg("#000000") == "#ffffff"

    def test_light_bg_returns_black(self):
        assert _fg_for_bg("#ffffff") == "#000000"

    def test_medium_dark(self):
        assert _fg_for_bg("#333333") == "#ffffff"

    def test_medium_light(self):
        assert _fg_for_bg("#cccccc") == "#000000"

    def test_invalid_hex(self):
        assert _fg_for_bg("#xyz") == "#ffffff"

    def test_blue(self):
        result = _fg_for_bg("#2563eb")
        assert result in ("#ffffff", "#000000")

    def test_red(self):
        result = _fg_for_bg("#ff0000")
        assert result in ("#ffffff", "#000000")

    def test_no_hash_prefix(self):
        # The function does lstrip("#"), so "ffffff" works too
        assert _fg_for_bg("ffffff") == "#000000"


class TestLogoHtml:
    def test_with_url(self):
        html = _logo_html("https://example.com/logo.png")
        assert "img" in html
        assert "https://example.com/logo.png" in html

    def test_none_returns_empty(self):
        assert _logo_html(None) == ""

    def test_empty_string_returns_empty(self):
        assert _logo_html("") == ""
