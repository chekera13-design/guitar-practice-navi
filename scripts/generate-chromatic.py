"""EX01を保持し、単独運指のEX02〜EX24を生成する開発専用スクリプト。"""
from pathlib import Path
import argparse
import copy
import hashlib
import io
import re
import zipfile
import xml.etree.ElementTree as ET

PATTERNS = (
    "1234", "1243", "1324", "1342", "1423", "1432",
    "2134", "2143", "2314", "2341", "2413", "2431",
    "3124", "3142", "3214", "3241", "3412", "3421",
    "4123", "4132", "4213", "4231", "4312", "4321",
)
ORIGINAL_SHA256 = "f298ac010fdf71979a12f737b71ca2e5126bfe4dc8cd4b9a09dc4d13ffb25199"
OPEN_MIDI = {1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40}
# EX01と同様、フラット表記を用いて実音を一意に表す。
PITCH_CLASSES = (("C", 0), ("D", -1), ("D", 0), ("E", -1),
                 ("E", 0), ("F", 0), ("G", -1), ("G", 0),
                 ("A", -1), ("A", 0), ("B", -1), ("B", 0))


def score_xml(source_xml, pattern, code):
    counter = 0

    def note(match):
        nonlocal counter
        original = match[0]
        string = int(re.search(r"<string>(\d+)</string>", original)[1])
        fret = int(pattern[counter % 4]) + 4
        midi = OPEN_MIDI[string] + fret
        step, alter = PITCH_CLASSES[midi % 12]
        pitch = "<pitch>\n          <step>" + step + "</step>\n"
        if alter:
            pitch += "          <alter>" + str(alter) + "</alter>\n"
        pitch += "          <octave>" + str(midi // 12 - 1) + "</octave>\n          </pitch>"
        result = re.sub(r"<pitch>[\s\S]*?</pitch>", lambda _: pitch, original, count=1)
        result = re.sub(r"<fret>\d+</fret>", "<fret>" + str(fret) + "</fret>", result, count=1)
        # 別の音高の臨時記号を残さない。TABではpitchのalterが実音の基準。
        result = re.sub(r"\s*<accidental(?:\s[^>]*)?>[^<]*</accidental>", "", result)
        counter += 1
        return result

    result = re.sub(r"<note\b[^>]*>[\s\S]*?</note>", note, source_xml)
    if counter != 96:
        raise ValueError("EX01 must contain exactly 96 notes")
    title = "クロマチック " + code + "・運指" + pattern
    result = re.sub(r"<work-title>[\s\S]*?</work-title>",
                    lambda _: "<work-title>" + title + "</work-title>", result, count=1)
    ET.fromstring(result)
    return result.encode("utf-8")


def generate(source, output):
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != ORIGINAL_SHA256:
        raise ValueError("EX01原本のハッシュ不一致")
    output.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(source) as archive:
        if archive.namelist() != ["META-INF/container.xml", "score.xml"]:
            raise ValueError("Unexpected EX01 MXL container")
        source_xml = archive.read("score.xml").decode("utf-8")
        for number, pattern in enumerate(PATTERNS[1:], 2):
            code = "EX" + str(number).zfill(2)
            target = output / (code.lower() + ".mxl")
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w") as dest:
                for info in archive.infolist():
                    data = score_xml(source_xml, pattern, code) if info.filename == "score.xml" else archive.read(info.filename)
                    dest.writestr(copy.copy(info), data)
            data = buffer.getvalue()
            if target.exists() and target.read_bytes() != data:
                raise FileExistsError("既存の異なるファイルは上書きしません: " + str(target))
            target.write_bytes(data)
    if source.read_bytes() != raw:
        raise AssertionError("Original EX01 changed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path(__file__).resolve().parents[1] / "scores/chromatic/ex01.mxl")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    generate(args.source, args.output or args.source.parent)
    print("EX02〜EX24：23ファイル生成、EX01原本変更なし")
