// fretsは6弦→1弦。nullは鳴らさない弦、0は開放弦。押弦データの唯一の定義元。
export const CHORD_FORMS = [
    { "id": "c-major-open", "name": "C", "root": "C", "quality": "major", "positionType": "open", "frets": [null, 3, 2, 0, 1, 0] },
    { "id": "d-major-open", "name": "D", "root": "D", "quality": "major", "positionType": "open", "frets": [null, null, 0, 2, 3, 2] },
    { "id": "e-major-open", "name": "E", "root": "E", "quality": "major", "positionType": "open", "frets": [0, 2, 2, 1, 0, 0] },
    { "id": "g-major-open", "name": "G", "root": "G", "quality": "major", "positionType": "open", "frets": [3, 2, 0, 0, 0, 3] },
    { "id": "a-major-open", "name": "A", "root": "A", "quality": "major", "positionType": "open", "frets": [null, 0, 2, 2, 2, 0] },
    { "id": "a-minor-open", "name": "Am", "root": "A", "quality": "minor", "positionType": "open", "frets": [null, 0, 2, 2, 1, 0] },
    { "id": "d-minor-open", "name": "Dm", "root": "D", "quality": "minor", "positionType": "open", "frets": [null, null, 0, 2, 3, 1] },
    { "id": "e-minor-open", "name": "Em", "root": "E", "quality": "minor", "positionType": "open", "frets": [0, 2, 2, 0, 0, 0] }
];
