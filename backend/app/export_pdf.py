# app/export_pdf.py
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from datetime import datetime
from io import BytesIO
from pathlib import Path
from PIL import Image as PILImage
import base64

def _maybe_logo_image(logo_b64: str, max_width_mm=40):
    if not logo_b64:
        return None
    try:
        data = base64.b64decode(logo_b64)
        img = PILImage.open(BytesIO(data))
        buf = BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return buf
    except Exception as e:
        print("Logo parse failed:", e)
        return None

def export_pdf_structured(content: str, references: list = None, file_path: str = None, filename: str = "doc", title: str = None, author: str = None, logo_b64: str = None):
    """
    content: main body text (string). Newlines allowed.
    references: list of dicts like {"source": "file.pdf", "chunk_id": 2, "citation": "file.pdf (chunk 2)"}
    file_path: if provided, saves to disk and returns path. Otherwise returns bytes.
    """
    styles = getSampleStyleSheet()
    normal = styles["Normal"]
    h1 = ParagraphStyle("Heading1", parent=styles["Heading1"], fontSize=16, spaceAfter=8)
    h2 = ParagraphStyle("Heading2", parent=styles["Heading2"], fontSize=12, spaceAfter=6)

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)

    story = []

    # Logo
    logo_buf = _maybe_logo_image(logo_b64)
    if logo_buf:
        try:
            img = Image(logo_buf, width=40*mm, height=None)
            story.append(img)
            story.append(Spacer(1, 6))
        except Exception as e:
            print("Logo add failed:", e)

    # Title
    if not title:
        title = filename
    story.append(Paragraph(title, h1))
    meta_line = f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
    if author:
        meta_line = f"{meta_line} — {author}"
    story.append(Paragraph(meta_line, normal))
    story.append(Spacer(1, 12))

    # Body (split into paragraphs)
    for p in content.split("\n\n"):
        # protect very long lines
        p = p.strip()
        if not p:
            continue
        story.append(Paragraph(p.replace("\n", "<br/>"), normal))
        story.append(Spacer(1, 6))

    # Citations Table
    if references:
        story.append(PageBreak())
        story.append(Paragraph("Citations", h2))
        table_data = [["#", "Source", "Chunk ID", "Details / Citation"]]
        for i, r in enumerate(references, start=1):
            src = r.get("source", "")
            chunk = str(r.get("chunk_id", ""))
            citation = r.get("citation", "")
            table_data.append([str(i), src, chunk, citation])

        tbl = Table(table_data, colWidths=[20*mm, 60*mm, 25*mm, 80*mm])
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#f2f2f2")),
            ("GRID", (0,0), (-1,-1), 0.5, colors.grey),
            ("VALIGN", (0,0), (-1,-1), "TOP"),
            ("LEFTPADDING", (0,0), (-1,-1), 6),
            ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ]))
        story.append(tbl)

    doc.build(story)

    buffer.seek(0)
    if file_path:
        Path(file_path).parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(buffer.read())
        return str(file_path)
    return buffer.read()

def export_pdf(content: str, file_path: str):
    """Backward compatibility wrapper for simple exports"""
    return export_pdf_structured(content=content, file_path=file_path, filename="export")
