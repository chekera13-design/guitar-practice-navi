"""確認済みC見本と共通フォーム定義から基本コードMXLを生成（開発専用）。"""
import argparse
import copy
import hashlib
import io
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
import zipfile

SAMPLE_SHA256 = "42241081f2bc9d2167d4ab6781b3ad2aaa55d8f939339bff0891a472934f07e3"
OPEN_MIDI = {1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40}
SHARP_PITCHES = (("C", 0), ("C", 1), ("D", 0), ("D", 1),
                 ("E", 0), ("F", 0), ("F", 1), ("G", 0),
                 ("G", 1), ("A", 0), ("A", 1), ("B", 0))


def make_xml(source_xml, form, code):
    def measure(match):
        text = match[0]
        notes = list(re.finditer(r"<note\b[^>]*>[\s\S]*?</note>", text))
        first = notes[0][0]
        if "<chord" in first or "<type>whole</type>" not in first:
            raise ValueError("Unexpected whole-note chord template")
        rewritten = []
        for index, fret in enumerate(form["frets"]):
            if fret is None:
                continue
            string = 6 - index
            midi = OPEN_MIDI[string] + fret
            step, alter = SHARP_PITCHES[midi % 12]
            pitch = "<pitch>\n          <step>" + step + "</step>\n"
            if alter:
                pitch += "          <alter>" + str(alter) + "</alter>\n"
            pitch += "          <octave>" + str(midi // 12 - 1) + "</octave>\n          </pitch>"
            note = re.sub(r"<pitch>[\s\S]*?</pitch>", lambda _: pitch, first, count=1)
            note = re.sub(r"<string>\d+</string>", "<string>" + str(string) + "</string>", note, count=1)
            note = re.sub(r"<fret>\d+</fret>", "<fret>" + str(fret) + "</fret>", note, count=1)
            note = re.sub(r'default-y="[^"]*"', 'default-y="' + str(-(string - 1) * 15) + '"', note, count=1)
            if rewritten:
                note = re.sub(r"(<note\b[^>]*>\s*)", lambda m: m[1] + "<chord/>\n        ", note, count=1)
            rewritten.append(note)
        return text[:notes[0].start()] + "\n      ".join(rewritten) + text[notes[-1].end():]

    result = re.sub(r"<measure\b[^>]*>[\s\S]*?</measure>", measure, source_xml)
    result = re.sub(r"<root-step>[^<]+</root-step>", "<root-step>" + form["root"] + "</root-step>", result)
    result = re.sub(r"<kind>[^<]+</kind>", "<kind>" + form["quality"] + "</kind>", result)
    result = re.sub(r"<work-title>[\s\S]*?</work-title>",
                    "<work-title>コード練習 " + code + "・" + form["name"] + "</work-title>", result, count=1)
    tree = ET.fromstring(result)
    if len(tree.findall("part/measure")) != 2:
        raise ValueError("Expected two measures")
    return result.encode("utf-8")


def generate(source, forms_file, output):
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != SAMPLE_SHA256:
        raise ValueError("確認済みC見本のハッシュ不一致")
    forms_text = forms_file.read_text(encoding="utf-8")
    forms = json.loads(re.search(r"export const CHORD_FORMS\s*=\s*(\[[\s\S]*\]);", forms_text)[1])
    if len(forms) != 8 or forms[0]["name"] != "C":
        raise ValueError("Expected eight basic chord forms")
    output.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(source) as archive:
        if archive.namelist() != ["META-INF/container.xml", "score.xml"]:
            raise ValueError("Unexpected MXL container")
        source_xml = archive.read("score.xml").decode("utf-8")
        for index, form in enumerate(forms):
            code = "EX" + str(index + 1).zfill(2)
            target = output / (code.lower() + ".mxl")
            if index == 0:
                data = raw  # Cの見本原本はバイト単位で保持する。
            else:
                buffer = io.BytesIO()
                with zipfile.ZipFile(buffer, "w") as dest:
                    for info in archive.infolist():
                        data = make_xml(source_xml, form, code) if info.filename == "score.xml" else archive.read(info.filename)
                        dest.writestr(copy.copy(info), data)
                data = buffer.getvalue()
            if target.exists() and target.read_bytes() != data:
                raise FileExistsError("既存の異なるファイルは上書きしません: " + str(target))
            if target.exists():
                continue  # 原本や同じ内容の生成物は書き直さない。
            target.write_bytes(data)
    if source.read_bytes() != raw:
        raise AssertionError("C sample changed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    root = Path(__file__).resolve().parents[1]
    parser.add_argument("--source", type=Path, default=root / "scores/chords/ex01.mxl")
    parser.add_argument("--forms", type=Path, default=root / "js/config/chordForms.js")
    parser.add_argument("--output", type=Path, default=root / "scores/chords")
    args = parser.parse_args()
    generate(args.source, args.forms, args.output)
    print("C原本を保持し、共通フォーム定義から基本8コードを生成")
