import streamlit as st
import json
import os

st.set_page_config(layout="wide", page_title="Plagiarism Viewer")

# ─── Load Report ────────────────────────────────────────────────────────────────
REPORT_PATH = os.path.join(os.path.dirname(__file__), "class_report.json")
FORENSIC_PATH = os.path.join(os.path.dirname(__file__), "forensic_report.json")

with open(REPORT_PATH, "r") as f:
    report = json.load(f)

forensic_data = {}
if os.path.exists(FORENSIC_PATH):
    with open(FORENSIC_PATH, "r") as f:
        forensic_list = json.load(f)
        for item in forensic_list:
            key = f"{item['student_1']}_{item['student_2']}"
            forensic_data[key] = item

# ─── Sidebar: Metadata & Boilerplate Info ───────────────────────────────────────
meta = report.get("metadata", {})
with st.sidebar:
    st.title("🔍 Engine Report")
    st.markdown("---")
    st.metric("Total Students", meta.get("total_students", "N/A"))
    st.metric("Pairs Possible", meta.get("total_pairs_possible", "N/A"))
    st.metric("Pairs Flagged", meta.get("pairs_flagged", "N/A"))
    st.metric("Similarity Threshold", meta.get("similarity_threshold", "N/A"))
    st.markdown("---")
    st.markdown("### 🧹 Boilerplate Filter")
    st.info(
        "The engine removes professor-provided template code before comparing. "
        "Only student-written fingerprints are compared."
    )

pairs = report.get("pairs", [])

if not pairs:
    st.warning("No suspicious pairs found.")
    st.stop()

# ─── Pair Selector ──────────────────────────────────────────────────────────────
pair_labels = [
    f"#{i+1}  {p['student_1']} vs {p['student_2']}  |  sim={p['similarity']}  |  sev={p['severity_score']}"
    for i, p in enumerate(pairs)
]

selected_index = st.selectbox("Select Suspicious Pair", range(len(pair_labels)), format_func=lambda i: pair_labels[i])
pair = pairs[selected_index]

# ─── Pair Header ────────────────────────────────────────────────────────────────
st.title(f"👥 {pair['student_1']}  vs  {pair['student_2']}")

c1, c2, c3, c4 = st.columns(4)
c1.metric("Similarity (Jaccard)", pair["similarity"])
c2.metric("Severity Score", pair["severity_score"])

summary = pair["summary"]
c3.metric("Total Blocks", summary["total_blocks"])
c4.metric("High Confidence Blocks", summary["high_confidence_blocks"])

cc1, cc2, cc3 = st.columns(3)
cc1.metric("Suspicious Lines (A)", summary["total_suspicious_lines_a"])
cc2.metric("Suspicious Lines (B)", summary["total_suspicious_lines_b"])
cc3.metric("Avg Block Density", summary["average_density"])

# ─── Boilerplate Removal Stats ──────────────────────────────────────────────────
forensic_key = f"{pair['student_1']}_{pair['student_2']}"
forensic = forensic_data.get(forensic_key)

with st.expander("🧹 Boilerplate Removal Details", expanded=False):
    st.markdown(
        "The engine fingerprints the professor's template and strips any matching hashes "
        "from each student submission *before* comparison. This ensures only original "
        "student code contributes to the similarity score."
    )
    if forensic:
        st.write(f"**Raw matches (after boilerplate removal):** {forensic['raw_match_count']}")
    else:
        st.write("No forensic data found for this pair.")

    st.markdown("#### Block-level density & confidence")
    if pair["blocks"]:
        import pandas as pd
        df = pd.DataFrame([
            {
                "Block": b["block_id"],
                "File A": b["file_a"],
                "Lines A": f"{b['start_a']}–{b['end_a']}",
                "File B": b["file_b"],
                "Lines B": f"{b['start_b']}–{b['end_b']}",
                "Length": b["block_length"],
                "Density": b["density"],
                "Confidence": b["confidence"],
            }
            for b in pair["blocks"]
        ])

        def color_confidence(val):
            colors = {"HIGH": "background-color:#ff4d4d;color:white",
                      "MEDIUM": "background-color:#ffa64d",
                      "LOW": "background-color:#ffff66"}
            return colors.get(val, "")

        st.dataframe(df.style.applymap(color_confidence, subset=["Confidence"]), use_container_width=True)

st.markdown("---")

# ─── File Selector ──────────────────────────────────────────────────────────────
student_left = pair["student_1"]
student_right = pair["student_2"]

files_left = list(pair["files"][student_left].keys())
selected_file = st.selectbox("Select File (left student)", files_left)

corresponding_blocks = [b for b in pair["blocks"] if b["file_a"] == selected_file]
file_right = corresponding_blocks[0]["file_b"] if corresponding_blocks else None

if not file_right:
    st.warning("No corresponding file found for the right student.")
    st.stop()

code_left = pair["sources"][student_left].get(selected_file, "// Source not found")
code_right = pair["sources"][student_right].get(file_right, "// Source not found")
highlight_ranges_left = pair["files"][student_left].get(selected_file, [])
highlight_ranges_right = pair["files"][student_right].get(file_right, [])

# ─── Code Highlighting ──────────────────────────────────────────────────────────
CONFIDENCE_COLORS = {"HIGH": "#ff4d4d", "MEDIUM": "#ffa64d", "LOW": "#ffff66"}

def highlight_code(lines, blocks, side):
    """Returns HTML with color-coded lines. side = 'a' or 'b'."""
    highlighted = []
    for idx, line in enumerate(lines, start=1):
        color = None
        for block in blocks:
            if side == "a" and block["file_a"] == selected_file:
                if block["start_a"] <= idx <= block["end_a"]:
                    color = CONFIDENCE_COLORS[block["confidence"]]
            elif side == "b" and block["file_b"] == file_right:
                if block["start_b"] <= idx <= block["end_b"]:
                    color = CONFIDENCE_COLORS[block["confidence"]]
        safe_line = (
            line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        )
        if color:
            highlighted.append(
                f"<div style='border-left:6px solid {color};padding-left:10px;"
                f"background-color:rgba(255,255,255,0.05);font-family:monospace;white-space:pre'>"
                f"{idx:4d}: {safe_line}</div>"
            )
        else:
            highlighted.append(
                f"<div style='font-family:monospace;white-space:pre;padding-left:16px'>"
                f"{idx:4d}: {safe_line}</div>"
            )
    return "\n".join(highlighted)

# ─── Legend ─────────────────────────────────────────────────────────────────────
st.markdown(
    "<div style='display:flex;gap:20px;margin-bottom:8px'>"
    "<span style='background:#ff4d4d;padding:2px 10px;border-radius:4px'>HIGH</span>"
    "<span style='background:#ffa64d;padding:2px 10px;border-radius:4px'>MEDIUM</span>"
    "<span style='background:#ffff66;color:#333;padding:2px 10px;border-radius:4px'>LOW</span>"
    "</div>",
    unsafe_allow_html=True,
)

col1, col2 = st.columns(2)

lines_left = code_left.splitlines()
lines_right = code_right.splitlines()

with col1:
    st.subheader(f"{student_left} — {selected_file}")
    st.markdown(
        f"<div style='height:600px;overflow-y:auto;background:#1e1e1e;padding:10px;border-radius:6px'>"
        f"{highlight_code(lines_left, pair['blocks'], 'a')}</div>",
        unsafe_allow_html=True,
    )

with col2:
    st.subheader(f"{student_right} — {file_right}")
    st.markdown(
        f"<div style='height:600px;overflow-y:auto;background:#1e1e1e;padding:10px;border-radius:6px'>"
        f"{highlight_code(lines_right, pair['blocks'], 'b')}</div>",
        unsafe_allow_html=True,
    )
