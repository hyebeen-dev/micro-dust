// 3.6 등급 기준표

function gradeFromThresholds(value, thresholds) {
  // thresholds: [{ max, grade }, ...] 오름차순, 마지막 항목은 max=Infinity
  for (const t of thresholds) {
    if (value <= t.max) return t.grade;
  }
  return thresholds[thresholds.length - 1].grade;
}

const PM10_THRESHOLDS = [
  { max: 30, grade: 1 },
  { max: 80, grade: 2 },
  { max: 150, grade: 3 },
  { max: Infinity, grade: 4 },
];

const PM25_THRESHOLDS = [
  { max: 15, grade: 1 },
  { max: 35, grade: 2 },
  { max: 75, grade: 3 },
  { max: Infinity, grade: 4 },
];

const CAI_THRESHOLDS = [
  { max: 50, grade: 1 },
  { max: 100, grade: 2 },
  { max: 250, grade: 3 },
  { max: Infinity, grade: 4 },
];

const O3_THRESHOLDS = [
  { max: 0.03, grade: 1 },
  { max: 0.09, grade: 2 },
  { max: 0.15, grade: 3 },
  { max: Infinity, grade: 4 },
];

const NO2_THRESHOLDS = [
  { max: 0.03, grade: 1 },
  { max: 0.06, grade: 2 },
  { max: 0.2, grade: 3 },
  { max: Infinity, grade: 4 },
];

const CO_THRESHOLDS = [
  { max: 2, grade: 1 },
  { max: 9, grade: 2 },
  { max: 15, grade: 3 },
  { max: Infinity, grade: 4 },
];

const SO2_THRESHOLDS = [
  { max: 0.02, grade: 1 },
  { max: 0.05, grade: 2 },
  { max: 0.15, grade: 3 },
  { max: Infinity, grade: 4 },
];

const gradePm10 = (v) => gradeFromThresholds(v, PM10_THRESHOLDS);
const gradePm25 = (v) => gradeFromThresholds(v, PM25_THRESHOLDS);
const gradeCai = (v) => gradeFromThresholds(v, CAI_THRESHOLDS);
const gradeO3 = (v) => gradeFromThresholds(v, O3_THRESHOLDS);
const gradeNo2 = (v) => gradeFromThresholds(v, NO2_THRESHOLDS);
const gradeCo = (v) => gradeFromThresholds(v, CO_THRESHOLDS);
const gradeSo2 = (v) => gradeFromThresholds(v, SO2_THRESHOLDS);

const GRADE_LABEL = { 1: '좋음', 2: '보통', 3: '나쁨', 4: '매우나쁨' };
const GRADE_ICON = { 1: '☀️', 2: '🙂', 3: '😷', 4: '⚠️' };

// 3.5 유효값 판정: null, 빈 문자열, "-", "통신장애"가 아닌 숫자만 유효
function toValidNumber(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === '' || s === '-' || s === '통신장애') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// 3.5 시·도 대표값 산출: 유효 측정소 산술평균, 등급은 평균값을 기준표에 재대입
// decimals: PM10/PM2.5/CAI는 정수(㎍/㎥, 지수)라 0, 오존·NO2·CO·SO2는 ppm 소수값이라 3
function averageField(items, field, gradeFn, decimals = 0) {
  const valid = [];
  for (const item of items) {
    const n = toValidNumber(item[field]);
    if (n !== null) valid.push({ station: item.stationName, value: n });
  }
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, v) => acc + v.value, 0);
  const factor = 10 ** decimals;
  const avg = Math.round((sum / valid.length) * factor) / factor;
  let max = valid[0];
  let min = valid[0];
  for (const v of valid) {
    if (v.value > max.value) max = v;
    if (v.value < min.value) min = v;
  }
  return {
    value: avg,
    grade: gradeFn(avg),
    validCount: valid.length,
    max,
    min,
  };
}

module.exports = {
  gradePm10,
  gradePm25,
  gradeCai,
  gradeO3,
  gradeNo2,
  gradeCo,
  gradeSo2,
  GRADE_LABEL,
  GRADE_ICON,
  toValidNumber,
  averageField,
};
