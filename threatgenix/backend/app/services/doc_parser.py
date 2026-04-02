"""PDF validation and text extraction using PyMuPDF.

Block 1: validate_pdf — checks file is PDF, non-empty, within page limit.
Block 2: extract_text_from_pdf — extracts text from all pages.
"""

import logging

import fitz  # PyMuPDF
from fastapi import HTTPException, UploadFile

from app.config import settings

logger = logging.getLogger(__name__)


async def validate_pdf(file: UploadFile) -> tuple[bytes, int]:
    """Validate uploaded file is a PDF with 1..pdf_max_pages pages.

    Returns:
        Tuple of (file_bytes, page_count).

    Raises:
        HTTPException(400) if file is not a valid PDF, has 0 pages,
        or exceeds the configured page limit.
    """
    pdf_bytes = await file.read()

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        raise HTTPException(status_code=400, detail="File is not a valid PDF.")

    page_count = doc.page_count
    doc.close()

    if page_count == 0:
        raise HTTPException(status_code=400, detail="PDF has no pages.")

    if page_count > settings.pdf_max_pages:
        raise HTTPException(
            status_code=400,
            detail=f"PDF exceeds maximum of {settings.pdf_max_pages} pages (got {page_count}).",
        )

    logger.info("pdf_validated filename=%s pages=%d", file.filename, page_count)
    return pdf_bytes, page_count


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from all pages of a PDF.

    Returns:
        Concatenated text from all pages, separated by newlines.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages_text = []
    for page in doc:
        pages_text.append(page.get_text())
    doc.close()
    return "\n".join(pages_text)
