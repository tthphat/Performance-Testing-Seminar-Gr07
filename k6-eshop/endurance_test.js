// ============================================================================
// Kịch bản 4: Endurance Test (endurance_test.js) - EShop Performance Testing
// Student: Truong Thanh Phat (23120319) - Nhóm 07
// ============================================================================
// Mục tiêu kỹ thuật:
// - Kiểm tra độ bền (Reliability & Soak Testing) của hệ thống trong thời gian dài
// - Phát hiện hiện tượng rò rỉ bộ nhớ (Memory Leak) của tiến trình Node.js và V8 Heap
// - Đánh giá xem độ trễ phản hồi (P95, P99) có bị suy giảm (Degradation) theo thời gian hay không
//
// Mô hình tải (Stages - Tổng thời gian: 30 phút):
// - Ramp-up (1m00s): Tăng dần lên 50 VUs
// - Steady State (28m00s): Duy trì mức tải liên tục 50 VUs
// - Ramp-down (1m00s): Giảm tải dần về 0
// - Tỷ lệ phân bổ tải: 90% Search / Browse, 10% Product Detail
// - Dữ liệu Data-Driven: Cấp phát từ users.csv qua SharedArray
// ============================================================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Trend } from 'k6/metrics';

// ---------------------------------------------------------------- CONFIG ---
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const STEADY_DURATION = __ENV.ENDURANCE_DURATION || '28m';

// Phân bổ tải tập trung vào tra cứu liên tục (90% Search, 10% Detail)
const WORKLOAD_MIX = {
  browse: 0.90, // 90% Tìm kiếm & duyệt danh sách
  detail: 0.10, // 10% Xem chi tiết sản phẩm
};

const KEYWORDS = ['iphone', 'samsung', 'macbook', 'airpods', 'keychron', 'pro', 'tai nghe', 'laptop'];
const FALLBACK_PRODUCTS = [
  { id: 1, name: 'iPhone 15 Pro Max', price: 30000000 },
  { id: 2, name: 'Samsung Galaxy S24 Ultra', price: 28000000 },
  { id: 3, name: 'MacBook Pro M3', price: 45000000 },
  { id: 4, name: 'Tai nghe AirPods Pro 2', price: 6000000 },
  { id: 5, name: 'Ban phim co Keychron Q1', price: 4000000 },
];

// Nạp danh sách tài khoản từ users.csv
const users = new SharedArray('eshop_users', function () {
  const content = open('./users.csv');
  const lines = content.split('\n').slice(1).filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const [email, password, id] = line.trim().split(',');
    return { email, password, id: parseInt(id) };
  });
});

// Custom Metrics theo dõi độ trễ theo thời gian
const searchLatencyTrend = new Trend('endurance_search_latency_ms');
const detailLatencyTrend = new Trend('endurance_detail_latency_ms');
const iterationCounter = new Counter('endurance_iterations_total');

// --------------------------------------------------------------- OPTIONS ---
export const options = {
  scenarios: {
    endurance_soak: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },             // 1 phút tăng tải lên 50 VUs
        { duration: STEADY_DURATION, target: 50 },  // Duy trì ổn định 50 VUs trong 28 phút
        { duration: '1m', target: 0 },              // 1 phút hạ tải về 0
      ],
      gracefulStop: '30s',
    },
  },
  thresholds: {
    // Cam kết SLO: Dù chạy 30 phút liên tục, P95 vẫn phải duy trì < 500ms
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'], // Tỷ lệ lỗi toàn thời gian phải dưới 1%
    checks: ['rate>0.99'],          // Assertions phải luôn đạt trên 99%

    'http_req_duration{endpoint:search}': ['p(95)<500'],
    'http_req_duration{endpoint:product_detail}': ['p(95)<500'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// ----------------------------------------------------------------- SETUP ---
export function setup() {
  console.log(`[Endurance Setup] Khởi tạo bài kiểm tra độ bền 30 phút tại ${BASE_URL}...`);
  const res = http.get(`${BASE_URL}/api/products?search=`, { tags: { endpoint: 'setup' } });
  let products = FALLBACK_PRODUCTS;
  try {
    const list = res.json();
    if (Array.isArray(list) && list.length > 0) products = list;
  } catch (_) {}
  console.log(`[Endurance Setup] Sẵn sàng kiểm tra độ bền với ${products.length} sản phẩm và ${users.length} tài khoản.`);
  return { products };
}

// ------------------------------------------------------------- VU STATE ---
let token = null;
let isFirstRun = true;

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function loginVU(email, password) {
  const payload = JSON.stringify({ email, password });
  const res = http.post(`${BASE_URL}/api/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'login' },
  });

  const ok = check(res, {
    '[Login] status 200': (r) => r.status === 200,
  });

  if (ok && res.json('token')) {
    token = res.json('token');
  }
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ----------------------------------------------------- WORKLOAD ACTIONS ---
function actionSearch() {
  const q = Math.random() < 0.25 ? '' : pick(KEYWORDS);
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/products?search=${encodeURIComponent(q)}`, {
    headers: authHeaders(),
    tags: { endpoint: 'search' },
  });

  searchLatencyTrend.add(Date.now() - start);

  check(res, {
    '[Search] status 200': (r) => r.status === 200,
    '[Search] kết quả hợp lệ': (r) => Array.isArray(r.json()),
  });
}

function actionProductDetail(products) {
  const item = pick(products);
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/products/${item.id}`, {
    headers: authHeaders(),
    tags: { endpoint: 'product_detail' },
  });

  detailLatencyTrend.add(Date.now() - start);

  check(res, {
    '[Detail] status 200': (r) => r.status === 200,
    '[Detail] đúng ID sản phẩm': (r) => r.json('id') === item.id,
  });
}

// ------------------------------------------------------------- MAIN LOOP ---
export default function (data) {
  // Stagger ngẫu nhiên 0 - 5 giây ở vòng lặp đầu tiên
  if (isFirstRun) {
    sleep(Math.random() * 5);
    isFirstRun = false;
  }

  // Mỗi VU lấy 1 tài khoản riêng từ users.csv và duy trì token suốt 30 phút
  if (!token) {
    const user = users[(__VU - 1) % users.length];
    loginVU(user.email, user.password);
  }

  // 90% Tìm kiếm, 10% Xem chi tiết
  const rand = Math.random();
  if (rand < WORKLOAD_MIX.browse) {
    actionSearch();
  } else {
    actionProductDetail(data.products);
  }

  iterationCounter.add(1);

  // Think time ngẫu nhiên 1 - 3 giây
  sleep(Math.random() * 2 + 1);
}
