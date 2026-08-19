// 3.1~3.3 에어코리아 API 호출 래퍼

const BASE_URL = process.env.AIRKOREA_BASE_URL || 'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc';
const SERVICE_KEY = process.env.AIRKOREA_SERVICE_KEY || '';

// 3.3 resultCode → 서비스 표준 에러 코드 매핑
const RESULT_CODE_MAP = {
  '00': null,
  '03': 'NO_DATA',
  '20': 'AUTH_ERROR',
  '22': 'TRAFFIC_EXCEEDED',
  '30': 'AUTH_ERROR',
  '99': 'UNKNOWN',
};

class AirApiError extends Error {
  constructor(code, detail) {
    super(`AirApiError: ${code}`);
    this.code = code; // NO_DATA | AUTH_ERROR | TRAFFIC_EXCEEDED | UNKNOWN | NETWORK_ERROR | TIMEOUT | PARSE_ERROR
    this.detail = detail;
  }
}

async function fetchJsonWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      // 에어코리아는 키 오류 등에서 XML/plain text를 200으로 내려주는 경우가 있음
      console.error('[airClient] JSON 파싱 실패:', text.slice(0, 300));
      throw new AirApiError('PARSE_ERROR', text.slice(0, 300));
    }
    return json;
  } catch (err) {
    if (err instanceof AirApiError) throw err;
    if (err.name === 'AbortError') throw new AirApiError('TIMEOUT', err.message);
    throw new AirApiError('NETWORK_ERROR', err.message);
  } finally {
    clearTimeout(timer);
  }
}

const RETRYABLE_CODES = new Set(['UNKNOWN', 'TIMEOUT', 'NETWORK_ERROR', 'PARSE_ERROR']);

// 에어코리아 게이트웨이가 종종 일시적 SERVICETIMEOUT_ERROR(OpenAPI_ServiceResponse)를
// 반환하는 것을 확인함 — 서비스키/파라미터와 무관한 일시 장애이므로 짧게 재시도한다.
// NO_DATA/AUTH_ERROR/TRAFFIC_EXCEEDED처럼 결정적인 오류는 재시도하지 않는다.
async function withRetry(fn, retries = 2, delayMs = 400) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof AirApiError && RETRYABLE_CODES.has(err.code);
      if (!retryable || attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}

function checkResultCode(json) {
  const header = json?.response?.header;
  const resultCode = header?.resultCode;
  if (resultCode === undefined) {
    const raw = JSON.stringify(json).slice(0, 300);
    console.error('[airClient] 예기치 못한 응답 구조:', raw);
    throw new AirApiError('UNKNOWN', raw);
  }
  const mapped = RESULT_CODE_MAP[resultCode];
  if (mapped) {
    console.error(`[airClient] resultCode=${resultCode} (${header.resultMsg})`);
    throw new AirApiError(mapped, `resultCode=${resultCode}`);
  }
  if (mapped === undefined) {
    console.error(`[airClient] 알 수 없는 resultCode=${resultCode} (${header.resultMsg})`);
    throw new AirApiError('UNKNOWN', `resultCode=${resultCode}`);
  }
}

// 시도별 실시간 측정정보 조회 (P0)
async function getCtprvnRltmMesureDnsty(sidoName) {
  return withRetry(async () => {
    const params = new URLSearchParams({
      serviceKey: SERVICE_KEY,
      returnType: 'json',
      numOfRows: '100',
      pageNo: '1',
      sidoName,
      ver: '1.3',
    });
    const url = `${BASE_URL}/getCtprvnRltmMesureDnsty?${params.toString()}`;
    const json = await fetchJsonWithTimeout(url);
    checkResultCode(json);
    return json?.response?.body?.items || [];
  });
}

// 측정소별 실시간 측정정보 조회 — 24시간 추이 그래프용 (P1)
async function getMsrstnAcctoRltmMesureDnsty(stationName) {
  return withRetry(async () => {
    const params = new URLSearchParams({
      serviceKey: SERVICE_KEY,
      returnType: 'json',
      numOfRows: '24',
      pageNo: '1',
      stationName,
      dataTerm: 'DAILY',
      ver: '1.3',
    });
    const url = `${BASE_URL}/getMsrstnAcctoRltmMesureDnsty?${params.toString()}`;
    const json = await fetchJsonWithTimeout(url);
    checkResultCode(json);
    return json?.response?.body?.items || []; // 최신순(내림차순) — 호출부에서 reverse() 필요
  });
}

module.exports = {
  AirApiError,
  getCtprvnRltmMesureDnsty,
  getMsrstnAcctoRltmMesureDnsty,
  serviceKeyLength: () => SERVICE_KEY.length,
};
