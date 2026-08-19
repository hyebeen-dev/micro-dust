(function () {
  'use strict';

  // 부록 A — 칩 노출 순서 그대로
  const SIDO_LIST = [
    '서울', '인천', '경기', '강원',
    '대전', '세종', '충북', '충남',
    '광주', '전북', '전남',
    '대구', '부산', '울산', '경북', '경남',
    '제주',
  ];

  const GRADE_LABEL = { 1: '좋음', 2: '보통', 3: '나쁨', 4: '매우나쁨' };
  const GRADE_ICON = { 1: '☀️', 2: '🙂', 3: '😷', 4: '⚠️' };

  const ADVICE = {
    1: { main: '마음껏 나가도 좋은 날이에요', detail: '야외 활동과 환기 모두 자유롭게 하셔도 좋습니다.' },
    2: { main: '평소처럼 활동해도 괜찮아요', detail: '민감군은 장시간 무리한 실외 활동을 조금 줄여 주세요.' },
    3: { main: '외출할 땐 마스크를 챙기세요', detail: '장시간 실외 활동을 줄이고, 창문은 되도록 닫아 두세요. 민감군은 실외 활동을 자제해 주세요.' },
    4: { main: '오늘은 실내에 머무는 걸 권해요', detail: '실외 활동을 삼가고, 부득이 외출 시 KF80 이상 보건용 마스크를 착용하세요. 환기 대신 공기청정기를 사용하세요.' },
    empty: { main: '지금은 정보를 가져올 수 없어요', detail: '측정소 점검 중일 수 있습니다. 잠시 후 다시 시도해 주세요.' },
  };

  const ERROR_MESSAGES = {
    NETWORK_ERROR: { message: '연결이 원활하지 않아요', retry: true },
    TIMEOUT: { message: '응답이 늦어지고 있어요', retry: true },
    UNKNOWN: { message: '데이터를 불러오지 못했어요', retry: true },
    PARSE_ERROR: { message: '데이터를 불러오지 못했어요', retry: true },
    AUTH_ERROR: { message: '데이터를 불러오지 못했어요', retry: true },
    TRAFFIC_EXCEEDED: { message: '오늘 조회 가능한 횟수를 모두 사용했어요', retry: false },
    NO_DATA: { message: '이 지역은 지금 측정값이 없어요. 다른 지역을 선택해 주세요.', retry: false },
    INVALID_SIDO: { message: '데이터를 불러오지 못했어요', retry: true },
  };

  const state = {
    selectedSido: null,
    controller: null,
    requestId: 0,
    chart: null,
  };

  const el = (id) => document.getElementById(id);

  function initChips() {
    const list = el('chip-list');
    SIDO_LIST.forEach((sido) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.textContent = sido;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', 'false');
      btn.dataset.sido = sido;
      btn.addEventListener('click', () => selectSido(sido));
      list.appendChild(btn);
    });
  }

  function updateChipSelection(sido) {
    document.querySelectorAll('.chip').forEach((btn) => {
      btn.setAttribute('aria-selected', String(btn.dataset.sido === sido));
    });
  }

  function hideAllPanels() {
    el('intro').hidden = true;
    el('skeleton').hidden = true;
    el('error-box').hidden = true;
    el('card').hidden = true;
  }

  function showSkeleton() {
    hideAllPanels();
    el('skeleton').hidden = false;
  }

  function showError(code) {
    hideAllPanels();
    const info = ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN;
    el('error-message').textContent = info.message;
    el('retry-btn').hidden = !info.retry;
    el('error-box').hidden = false;
  }

  function setBodyGrade(grade) {
    document.body.classList.remove('grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-empty');
    document.body.classList.add(grade ? `grade-${grade}` : 'grade-empty');
  }

  function isStale(dataTime) {
    if (!dataTime) return false;
    const parsed = new Date(dataTime.replace(' ', 'T') + '+09:00');
    if (Number.isNaN(parsed.getTime())) return false;
    return Date.now() - parsed.getTime() > 30 * 60 * 1000;
  }

  function renderCard(data) {
    if (data.empty) {
      setBodyGrade(null);
      hideAllPanels();
      el('card-region').textContent = data.sido;
      el('grade-icon').textContent = GRADE_ICON[4] ? '⚠️' : '';
      el('grade-text').textContent = '데이터 없음';
      el('card-time').textContent = data.dataTime ? `${data.dataTime} 기준` : '기준 시각 정보 없음';
      el('advice-main').textContent = ADVICE.empty.main;
      el('advice-detail').textContent = ADVICE.empty.detail;
      el('pm25-value').textContent = '—';
      el('pm10-value').textContent = '—';
      el('cai-value').textContent = '—';
      el('cai-gauge-fill').style.width = '0%';
      el('deviation').textContent = '';
      el('station-count').textContent = `측정소 ${data.stationCount || 0}곳`;
      el('other-items-list').innerHTML = '';
      el('card').hidden = false;
      return;
    }

    const worstGrade = data.worst ? data.worst.grade : null;
    setBodyGrade(worstGrade);
    hideAllPanels();

    el('card-region').textContent = data.sido;
    el('grade-icon').textContent = worstGrade ? GRADE_ICON[worstGrade] : '';
    el('grade-text').textContent = worstGrade ? GRADE_LABEL[worstGrade] : '정보 없음';

    el('stale-badge').hidden = !isStale(data.dataTime);
    el('card-time').textContent = data.dataTime ? `${data.dataTime} 기준` : '기준 시각 정보 없음';

    const advice = ADVICE[worstGrade] || ADVICE.empty;
    el('advice-main').textContent = advice.main;
    el('advice-detail').textContent = advice.detail;

    el('pm25-value').textContent = data.pm25
      ? `${data.pm25.value} ㎍/㎥ · ${GRADE_LABEL[data.pm25.grade]}`
      : '측정값 없음';
    el('pm10-value').textContent = data.pm10
      ? `${data.pm10.value} ㎍/㎥ · ${GRADE_LABEL[data.pm10.grade]}`
      : '측정값 없음';

    if (data.cai) {
      el('cai-value').textContent = `CAI ${data.cai.value} · ${GRADE_LABEL[data.cai.grade]}`;
      el('cai-gauge-fill').style.width = `${Math.min(100, (data.cai.value / 500) * 100)}%`;
    } else {
      el('cai-value').textContent = '측정값 없음';
      el('cai-gauge-fill').style.width = '0%';
    }

    if (data.deviation) {
      el('deviation').textContent =
        `가장 나쁨: ${data.deviation.max.station} ${data.deviation.max.value}㎍/㎥ · ` +
        `가장 좋음: ${data.deviation.min.station} ${data.deviation.min.value}㎍/㎥`;
    } else {
      el('deviation').textContent = '';
    }

    const countEl = el('station-count');
    countEl.textContent = `측정소 ${data.stationCount}곳 평균`;
    countEl.classList.toggle('warn', data.stationCount > 0 && data.stationCount < 3);
    if (data.stationCount > 0 && data.stationCount < 3) {
      countEl.textContent += ' · 측정소 수 적음, 신뢰도 낮음';
    }

    renderOtherItems(data);
    el('card').hidden = false;
  }

  function otherItemRow(name, entry, unit) {
    if (!entry) return `<li><span class="item-name">${name}</span><span class="item-value">측정값 없음</span></li>`;
    return `<li><span class="item-name">${name} · ${GRADE_LABEL[entry.grade]}</span><span class="item-value">${entry.value} ${unit}</span></li>`;
  }

  function renderOtherItems(data) {
    const list = el('other-items-list');
    list.innerHTML = [
      otherItemRow('오존', data.o3, 'ppm'),
      otherItemRow('이산화질소', data.no2, 'ppm'),
      otherItemRow('일산화탄소', data.co, 'ppm'),
      otherItemRow('아황산가스', data.so2, 'ppm'),
    ].join('');
  }

  async function loadTrend(sido, requestId, force) {
    try {
      const url = `/api/trend?sido=${encodeURIComponent(sido)}${force ? '&force=1' : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (requestId !== state.requestId) return;
      if (data.error) {
        el('chart-station-note').textContent = '추이 데이터를 불러오지 못했어요.';
        return;
      }
      renderTrend(data);
    } catch (e) {
      if (requestId !== state.requestId) return;
      el('chart-station-note').textContent = '추이 데이터를 불러오지 못했어요.';
    }
  }

  function renderTrend(data) {
    el('chart-station-note').textContent = `${data.station} 측정소 기준 · 이 값은 위 시·도 평균과 다를 수 있어요`;

    const labels = data.points.map((p) => (p.time ? p.time.slice(11, 16) : ''));
    const pm25Data = data.points.map((p) => p.pm25);
    const pm10Data = data.points.map((p) => p.pm10);

    renderTable(data.points);

    if (state.chart) {
      state.chart.destroy();
      state.chart = null;
    }

    const ctx = el('trend-chart').getContext('2d');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    state.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '초미세먼지 (PM2.5)',
            data: pm25Data,
            borderColor: '#2a78d6',
            backgroundColor: '#2a78d6',
            borderWidth: 2,
            tension: 0,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHitRadius: 24,
            spanGaps: false,
          },
          {
            label: '미세먼지 (PM10)',
            data: pm10Data,
            borderColor: '#eb6834',
            backgroundColor: '#eb6834',
            borderWidth: 2,
            tension: 0,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHitRadius: 24,
            spanGaps: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: reduceMotion ? false : {},
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            labels: { usePointStyle: true, pointStyle: 'line', color: '#898781' },
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label(ctx2) {
                const v = ctx2.parsed.y;
                if (v === null || v === undefined) return `${ctx2.dataset.label}: 결측`;
                const grade = ctx2.datasetIndex === 0
                  ? data.points[ctx2.dataIndex].pm25Grade
                  : data.points[ctx2.dataIndex].pm10Grade;
                return `${ctx2.dataset.label}: ${v} ㎍/㎥ (${GRADE_LABEL[grade] || '-'})`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#e1e0d9' },
            border: { display: false },
            ticks: { color: '#898781' },
          },
          x: {
            grid: { display: false },
            ticks: {
              color: '#898781',
              callback(value, index) {
                return index % 3 === 0 ? labels[index] : '';
              },
            },
          },
        },
      },
      plugins: [crosshairPlugin, endLabelPlugin],
    });
  }

  function renderTable(points) {
    const tbody = document.querySelector('#chart-table tbody');
    tbody.innerHTML = points.map((p) => {
      const pm25 = p.pm25 !== null ? `${p.pm25} (${GRADE_LABEL[p.pm25Grade]})` : '결측';
      const pm10 = p.pm10 !== null ? `${p.pm10} (${GRADE_LABEL[p.pm10Grade]})` : '결측';
      return `<tr><td>${p.time || '-'}</td><td>${pm25}</td><td>${pm10}</td></tr>`;
    }).join('');
  }

  const crosshairPlugin = {
    id: 'crosshair',
    afterDatasetsDraw(chart) {
      const active = chart.getActiveElements();
      if (!active || active.length === 0) return;
      const x = active[0].element.x;
      const { top, bottom } = chart.chartArea;
      const { ctx } = chart;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(43, 42, 39, 0.3)';
      ctx.stroke();
      ctx.restore();
    },
  };

  const endLabelPlugin = {
    id: 'endLabel',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      chart.data.datasets.forEach((ds, i) => {
        const meta = chart.getDatasetMeta(i);
        if (meta.hidden) return;
        for (let idx = ds.data.length - 1; idx >= 0; idx -= 1) {
          const v = ds.data[idx];
          if (v !== null && v !== undefined) {
            const point = meta.data[idx];
            if (!point) break;
            ctx.save();
            ctx.fillStyle = ds.borderColor;
            ctx.font = 'bold 12px sans-serif';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(v), point.x + 6, point.y);
            ctx.restore();
            break;
          }
        }
      });
    },
  };

  async function selectSido(sido, options) {
    const force = !!(options && options.force);
    if (sido === state.selectedSido && !force) return;

    state.selectedSido = sido;
    updateChipSelection(sido);
    showSkeleton();
    el('refresh-btn').hidden = false;

    const requestId = (state.requestId += 1);

    if (state.controller) state.controller.abort();
    const controller = new AbortController();
    state.controller = controller;
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const start = Date.now();

    try {
      const url = `/api/air?sido=${encodeURIComponent(sido)}${force ? '&force=1' : ''}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (requestId !== state.requestId) return;

      const elapsed = Date.now() - start;
      const remain = Math.max(0, 200 - elapsed);
      setTimeout(() => {
        if (requestId !== state.requestId) return;
        if (data.error) {
          showError(data.error);
        } else {
          renderCard(data);
        }
      }, remain);

      loadTrend(sido, requestId, force);
    } catch (err) {
      clearTimeout(timeoutId);
      if (requestId !== state.requestId) return;
      showError(err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR');
    }
  }

  function init() {
    initChips();
    el('refresh-btn').addEventListener('click', () => {
      if (state.selectedSido) selectSido(state.selectedSido, { force: true });
    });
    el('retry-btn').addEventListener('click', () => {
      if (state.selectedSido) selectSido(state.selectedSido, { force: true });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
