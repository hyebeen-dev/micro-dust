// 부록 A: 표시명 / API sidoName / 정식 명칭 (칩 노출 순서 그대로)
const SIDO_LIST = [
  { display: '서울', sidoName: '서울', fullName: '서울특별시' },
  { display: '인천', sidoName: '인천', fullName: '인천광역시' },
  { display: '경기', sidoName: '경기', fullName: '경기도' },
  { display: '강원', sidoName: '강원', fullName: '강원특별자치도' },
  { display: '대전', sidoName: '대전', fullName: '대전광역시' },
  { display: '세종', sidoName: '세종', fullName: '세종특별자치시' },
  { display: '충북', sidoName: '충북', fullName: '충청북도' },
  { display: '충남', sidoName: '충남', fullName: '충청남도' },
  { display: '광주', sidoName: '광주', fullName: '광주광역시' },
  { display: '전북', sidoName: '전북', fullName: '전북특별자치도' },
  { display: '전남', sidoName: '전남', fullName: '전라남도' },
  { display: '대구', sidoName: '대구', fullName: '대구광역시' },
  { display: '부산', sidoName: '부산', fullName: '부산광역시' },
  { display: '울산', sidoName: '울산', fullName: '울산광역시' },
  { display: '경북', sidoName: '경북', fullName: '경상북도' },
  { display: '경남', sidoName: '경남', fullName: '경상남도' },
  { display: '제주', sidoName: '제주', fullName: '제주특별자치도' },
];

const VALID_SIDO_NAMES = new Set(SIDO_LIST.map((s) => s.sidoName));

// 시·도별 대표 측정소 캐시 (PRD 열린 이슈 #6: 하드코딩 대신
// getCtprvnRltmMesureDnsty 응답의 첫 측정소를 최초 조회 시 고정 채택)
const representativeStationCache = new Map();

function getCachedStation(sidoName) {
  return representativeStationCache.get(sidoName) || null;
}

function setCachedStation(sidoName, stationName) {
  representativeStationCache.set(sidoName, stationName);
}

function isValidSido(sidoName) {
  return VALID_SIDO_NAMES.has(sidoName);
}

module.exports = {
  SIDO_LIST,
  isValidSido,
  getCachedStation,
  setCachedStation,
};
