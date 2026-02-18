import streamlit as st
import json

st.set_page_config(layout="wide")

# Load new structured report
with open("/Users/rishimodi/Desktop/Engine/4P02-Project/backend/class_report.json", "r") as f:
    report = json.load(f)

pairs = report.get("pairs", [])

if not pairs:
    st.write("No suspicious pairs found.")
    st.stop()

# Sidebar: Pair selection sorted by severity
pair_labels = [
    f"{p['student_1']} vs {p['student_2']} | sim={p['similarity']} | sev={p['severity_score']}"
    for p in pairs
]

selected_index = st.selectbox(
    "Select Suspicious Pair",
    range(len(pair_labels)),
    format_func=lambda i: pair_labels[i]
)

pair = pairs[selected_index]

st.title(f"{pair['student_1']} vs {pair['student_2']}")
st.write(f"Similarity: {pair['similarity']}")
st.write(f"Severity Score: {pair['severity_score']}")

summary = pair["summary"]

st.write("### Summary")
st.write(summary)

# Select file (left side student)
student_left = pair["student_1"]
student_right = pair["student_2"]

files_left = list(pair["files"][student_left].keys())

selected_file = st.selectbox("Select File", files_left)

code_left = pair["sources"][student_left][selected_file]
highlight_ranges_left = pair["files"][student_left][selected_file]

# Find corresponding file on right
corresponding_blocks = [
    b for b in pair["blocks"] if b["file_a"] == selected_file
]

# Build right file mapping
file_right = None
if corresponding_blocks:
    file_right = corresponding_blocks[0]["file_b"]

if not file_right:
    st.warning("No corresponding file found on right side.")
    st.stop()

code_right = pair["sources"][student_right][file_right]
highlight_ranges_right = pair["files"][student_right][file_right]

lines_left = code_left.splitlines()
lines_right = code_right.splitlines()

# Helper to highlight lines
def highlight_code(lines, ranges, blocks):
    highlighted = []
    range_map = {}

    for r in ranges:
        range_map[(r["start"], r["end"])] = r["block_id"]

    for idx, line in enumerate(lines, start=1):
        color = None
        for block in blocks:
            if block["file_a"] == selected_file:
                if block["start_a"] <= idx <= block["end_a"]:
                    if block["confidence"] == "HIGH":
                        color = "#ff4d4d"
                    elif block["confidence"] == "MEDIUM":
                        color = "#ffa64d"
                    else:
                        color = "#ffff66"
            if file_right and block["file_b"] == file_right:
                if block["start_b"] <= idx <= block["end_b"]:
                    if block["confidence"] == "HIGH":
                        color = "#ff4d4d"
                    elif block["confidence"] == "MEDIUM":
                        color = "#ffa64d"
                    else:
                        color = "#ffff66"

        if color:
            highlighted.append(
                f"<div style='border-left: 6px solid {color}; padding-left:10px; background-color: rgba(255,255,255,0.05);'>{idx:4d}: {line}</div>"
            )
        else:
            highlighted.append(f"<div>{idx:4d}: {line}</div>")

    return "\n".join(highlighted)


col1, col2 = st.columns(2)

with col1:
    st.subheader(f"{student_left} - {selected_file}")
    st.markdown(
        highlight_code(lines_left, highlight_ranges_left, pair["blocks"]),
        unsafe_allow_html=True
    )

with col2:
    st.subheader(f"{student_right} - {file_right}")
    st.markdown(
        highlight_code(lines_right, highlight_ranges_right, pair["blocks"]),
        unsafe_allow_html=True
    )