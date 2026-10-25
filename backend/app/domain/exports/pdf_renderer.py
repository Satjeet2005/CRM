"""WeasyPrint PDF quotation rendering pipeline with template versioning and SSRF protection.

The HTML/CSS template is version-controlled and rendered using a customer-safe DTO.
URL fetching is strictly disabled to prevent Server-Side Request Forgery (SSRF)
and local file exfiltration vulnerabilities.
"""

from pathlib import Path
from typing import Any

import jinja2
import weasyprint

from app.domain.exports.dto import QuoteExportDTO

TEMPLATE_VERSION = "forgeflow-quotation-template/1.0.0"

_TEMPLATES_DIR = Path(__file__).resolve().parent.parent.parent / "templates"
_jinja_env = jinja2.Environment(
    loader=jinja2.FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=True,
)


def safe_url_fetcher(url: str, timeout: int = 10, ssl_context: Any = None) -> dict:  # type: ignore[type-arg]
    """SSRF guard: forbid fetching arbitrary network or external filesystem resources."""
    raise ValueError(f"External network and file resource fetching is strictly forbidden: {url}")


def render_quote_html(dto: QuoteExportDTO) -> str:
    """Render the customer-safe quotation HTML using Jinja2 with autoescaping."""
    template = _jinja_env.get_template("quotation.html")
    return template.render(dto=dto)


def render_quote_pdf(dto: QuoteExportDTO) -> bytes:
    """Render a customer-safe QuoteExportDTO into PDF bytes using WeasyPrint.

    Returns raw byte sequence prefixed with %PDF.
    """
    html_content = render_quote_html(dto)
    doc = weasyprint.HTML(string=html_content, url_fetcher=safe_url_fetcher)
    pdf_bytes: bytes = doc.write_pdf()
    return pdf_bytes
