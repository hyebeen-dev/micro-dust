// server.js(로컬 Express)와 api/*.js(Vercel 서버리스 함수)가 공유하는 라우트 로직.
// Express/Vercel 어느 쪽도 알지 못하는 순수 함수로 유지한다.

const { getCachedStation, setCachedStation } = require('./stations');
const {
  gradePm10, gradePm25, gradeCai, gradeO3, gradeNo2, gradeCo, gradeSo2,
  averageField, toValidNumber,
} = require('./grades');
const { getCtprvnRltmMesureDnsty, getMsrstnAcctoRltmMesureDnsty, AirApiError, serviceKeyLength } = require('./airClient');
const { TtlCache } = require('./cache');

const AIR_CACHE_TTL_MS = 10 * 60 * 1000; // 10분 (3.7)
const TREND_CACHE_TTL_MS = 30 * 60 * 1000; // 30분 (5.7)

const airCache = new TtlCache();
const trendCache = new TtlCache();

// 3.5 시·도 대표값 산출
function buildSidoSummary(sidoName, items) {
  const pm10 = averageField(items, 'pm10Value', gradePm10);
  const pm25 = averageField(items, 'pm25Value', gradePm25);
  const cai = averageField(items, 'khaiValue', gradeCai);
  const o3 = averageField(items, 'o3Value', gradeO3, 3);
  const no2 = averageField(items, 'no2Value', gradeNo2, 3);
  const co = averageField(items, 'coValue', gradeCo, 1);
  const so2 = averageField(items, 'so2Value', gradeSo2, 3);

  // 가장 최신 dataTime
  let latestDataTime = null;
  for (const item of items) {
    if (item.dataTime && (!latestDataTime || item.dataTime > latestDataTime)) {
      latestDataTime = item.dataTime;
    }
  }

  // 유효 측정소 수 (pm10 또는 pm25 중 하나라도 유효한 측정소 기준)
  const stationCount = items.filter(
    (it) => toValidNumber(it.pm10Value) !== null || toValidNumber(it.pm25Value) !== null
  ).length;

  if (!pm10 && !pm25) {
    return {
      sido: sidoName,
      dataTime: latestDataTime,
      stationCount,
      empty: true,
    };
  }

  // F-05: PM2.5·PM10 중 더 나쁜 등급 채택, 둘 다 없으면 CAI, 그것도 없으면 무채색
  let worst = null;
  if (pm25 && pm10) {
    worst = pm25.grade >= pm10.grade
      ? { value: pm25.value, grade: pm25.grade, source: 'pm25' }
      : { value: pm10.value, grade: pm10.grade, source: 'pm10' };
  } else if (pm25) {
    worst = { value: pm25.value, grade: pm25.grade, source: 'pm25' };
  } else if (pm10) {
    worst = { value: pm10.value, grade: pm10.grade, source: 'pm10' };
  } else if (cai) {
    worst = { value: cai.value, grade: cai.grade, source: 'cai' };
  }

  // 편차: PM2.5(카드에서 가장 크게 보여주는 지표) 기준, 없으면 PM10
  const deviationSource = pm25 || pm10;

  return {
    sido: sidoName,
    dataTime: latestDataTime,
    stationCount,
    empty: false,
    pm10: pm10 ? { value: pm10.value, grade: pm10.grade } : null,
    pm25: pm25 ? { value: pm25.value, grade: pm25.grade } : null,
    cai: cai ? { value: cai.value, grade: cai.grade } : null,
    o3: o3 ? { value: o3.value, grade: o3.grade } : null,
    no2: no2 ? { value: no2.value, grade: no2.grade } : null,
    co: co ? { value: co.value, grade: co.grade } : null,
    so2: so2 ? { value: so2.value, grade: so2.grade } : null,
    worst,
    deviation: deviationSource
      ? {
          max: { station: deviationSource.max.station, value: deviationSource.max.value },
          min: { station: deviationSource.min.station, value: deviationSource.min.value },
        }
      : null,
  };
}

function mapApiError(err, sido) {
  if (err instanceof AirApiError) {
    console.error(`[api] sido=${sido} code=${err.code} detail=${err.detail}`);
    // 이 API는 오류 상황에서도 HTTP 200을 반환하는 경우가 있어(3.3),
    // 클라이언트는 상태 코드가 아닌 body.error로 분기한다.
    // detail/serviceKeyLength는 배포 환경 진단용 임시 필드 — 민감정보(키 값 자체) 아님.
    return { status: 200, body: { error: err.code, detail: err.detail, serviceKeyLength: serviceKeyLength() } };
  }
  console.error('[api] 예기치 못한 오류:', err);
  return { status: 500, body: { error: 'UNKNOWN' } };
}

async function handleAir(sido, { force = false } = {}) {
  if (!force) {
    const cached = airCache.get(sido);
    if (cached) return { status: 200, body: { ...cached, cached: true } };
  }

  try {
    const items = await getCtprvnRltmMesureDnsty(sido);
    const summary = buildSidoSummary(sido, items);
    airCache.set(sido, summary, AIR_CACHE_TTL_MS);

    // 대표 측정소 미확정 시, 이 응답을 재사용해 첫 측정소를 대표로 고정 (열린 이슈 #6)
    if (!getCachedStation(sido) && items.length > 0 && items[0].stationName) {
      setCachedStation(sido, items[0].stationName);
    }

    return { status: 200, body: { ...summary, cached: false } };
  } catch (err) {
    return mapApiError(err, sido);
  }
}

async function handleTrend(sido, { force = false } = {}) {
  if (!force) {
    const cached = trendCache.get(sido);
    if (cached) return { status: 200, body: { ...cached, cached: true } };
  }

  try {
    let station = getCachedStation(sido);
    if (!station) {
      const items = await getCtprvnRltmMesureDnsty(sido);
      if (items.length === 0 || !items[0].stationName) {
        return { status: 502, body: { error: 'NO_DATA' } };
      }
      station = items[0].stationName;
      setCachedStation(sido, station);
    }

    const raw = await getMsrstnAcctoRltmMesureDnsty(station);
    const ascending = [...raw].reverse(); // 3.2: 응답은 최신순 → 오름차순 전환

    const points = ascending.map((item) => {
      const pm25 = toValidNumber(item.pm25Value);
      const pm10 = toValidNumber(item.pm10Value);
      return {
        time: item.dataTime,
        pm25,
        pm25Grade: pm25 !== null ? gradePm25(pm25) : null,
        pm10,
        pm10Grade: pm10 !== null ? gradePm10(pm10) : null,
      };
    });

    const payload = { sido, station, points };
    trendCache.set(sido, payload, TREND_CACHE_TTL_MS);
    return { status: 200, body: { ...payload, cached: false } };
  } catch (err) {
    return mapApiError(err, sido);
  }
}

module.exports = { handleAir, handleTrend, buildSidoSummary };
