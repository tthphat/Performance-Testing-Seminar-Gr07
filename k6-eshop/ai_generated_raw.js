// EShop baseline mixed workload — Grafana k6
// Run:  k6 run eshop_mixed_load.js
// Opt:  k6 run -e BASE_URL=http://localhost:3000 -e COUPON_CODE=SAVE10 eshop_mixed_load.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

// ---------------------------------------------------------------- config ---
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
// ============================================================================
// ❌ [AI-AUDIT-BUG #1: THIẾU DATA-DRIVEN - DÙNG 1 TÀI KHOẢN TĨNH TỪ HAR]
// AI bóc tách cứng 1 tài khoản từ HAR. Khi phát tải nhiều VUs (50 - 500 VUs),
// tất cả VUs dùng chung 1 user -> Gây xung đột và sập luồng vì mã SAVE10 chỉ dùng 1 lần!
// ============================================================================
const EMAIL = __ENV.USER_EMAIL || 'test@eshop.com';        // from your HAR
const PASSWORD = __ENV.USER_PASSWORD || 'Test1234!';       // from your HAR
const COUPON_CODE = __ENV.COUPON_CODE || 'SAVE10';               // leave empty to skip apply-coupon

// Mix: 70% search/list, 25% product detail, 5% checkout
const MIX = { browse: 0.70, detail: 0.25 /* remaining 0.05 = checkout */ };

// Search terms taken from the product catalog seen in the HAR
const KEYWORDS = ['iphone', 'samsung', 'macbook', 'airpods', 'keychron', 'pro', 'tai nghe'];
const FALLBACK_PRODUCT_IDS = [1, 2, 3, 4, 5];

const businessErrors = new Counter('business_errors');

// --------------------------------------------------------------- options ---
export const options = {
  scenarios: {
    baseline_mixed: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      gracefulStop: '30s',
    },
  },
  thresholds: {
    // Global SLOs
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    // Per-endpoint breakdown (same SLO, so you can see which one breaks it)
    'http_req_duration{endpoint:login}': ['p(95)<500'],
    'http_req_duration{endpoint:search}': ['p(95)<500'],
    'http_req_duration{endpoint:product_detail}': ['p(95)<500'],
    'http_req_duration{endpoint:apply_coupon}': ['p(95)<500'],
    'http_req_duration{endpoint:checkout}': ['p(95)<500'],
    'http_req_duration{endpoint:my_orders}': ['p(95)<500'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'max'],
};

// ----------------------------------------------------------------- setup ---
// Discover real product IDs once so detail/checkout never hit a 404.
export function setup() {
  const res = http.get(`${BASE_URL}/api/products?search=`, { tags: { endpoint: 'setup' } });
  let ids = FALLBACK_PRODUCT_IDS;
  try {
    const list = res.json();
    if (Array.isArray(list) && list.length) ids = list.map((p) => p.id);
  } catch (_) { /* keep fallback */ }
  return { productIds: ids };
}

// ------------------------------------------------------------ VU helpers ---
// Module scope is per-VU in k6, so each VU logs in once and reuses its token
// (avoids hammering /login and tripping the login_attempts / locked_until logic).
let token = null;
let firstIteration = true;

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function login() {
  const res = http.post(
    `${BASE_URL}/api/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'login' } },
  );
  const ok = check(res, {
    'login: status 200': (r) => r.status === 200,
    'login: has token': (r) => !!r.json('token'),
  });
  token = ok ? res.json('token') : null;
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ------------------------------------------------------------- scenarios ---
function browse() {
  // ~40% full list (empty search, like the SPA home page), ~60% keyword search
  const q = Math.random() < 0.4 ? '' : pick(KEYWORDS);
  const res = http.get(`${BASE_URL}/api/products?search=${encodeURIComponent(q)}`, {
    headers: authHeaders(),
    tags: { endpoint: 'search' },
  });
  check(res, {
    'search: status 200': (r) => r.status === 200,
    'search: returns array': (r) => Array.isArray(r.json()),
  });
}

function productDetail(ids) {
  const id = pick(ids);
  const res = http.get(`${BASE_URL}/api/products/${id}`, {
    headers: authHeaders(),
    tags: { endpoint: 'product_detail' },
  });
  check(res, {
    'detail: status 200': (r) => r.status === 200,
    'detail: id matches': (r) => r.json('id') === id,
  });
}

// ============================================================================
// ❌ [AI-AUDIT-BUG #2: SAI QUY CHUẨN PAYLOAD CAMELCASE & THIẾU total_amount]
// Do tệp HAR thiếu bước checkout, AI tự suy đoán (hallucinate) payload dạng camelCase:
// { productId, shippingAddress, paymentMethod } và bỏ quên trường 'total_amount'.
// Backend Express bắt buộc snake_case: { total_amount, shipping_address } -> Server trả HTTP 400!
// ============================================================================
function buildCheckoutPayload(ids, couponApplied) {
  return {
    items: [{ productId: pick(ids), quantity: 1 }],
    ...(couponApplied ? { couponCode: COUPON_CODE } : {}),
    shippingAddress: '123 Load Test St, Ho Chi Minh City',
    paymentMethod: 'COD',
  };
}

function checkoutFlow(ids) {
  let couponApplied = false;

  // ==========================================================================
  // ❌ [AI-AUDIT-BUG #3: GỌI COUPON THIẾU total_amount VÀ user_id]
  // AI chỉ gửi { code: 'SAVE10' }. Backend yêu cầu kiểm tra total_amount > min_amount.
  // Vì total_amount bị undefined nên API lập tức văng lỗi HTTP 400 (100% Fail)!
  // ==========================================================================
  if (COUPON_CODE) {
    const c = http.post(
      `${BASE_URL}/api/apply-coupon`,
      JSON.stringify({ code: COUPON_CODE }),   // ASSUMPTION: body field name
      { headers: authHeaders(), tags: { endpoint: 'apply_coupon' } },
    );
    couponApplied = check(c, { 'coupon: status 200': (r) => r.status === 200 });
    sleep(Math.random() * 1 + 0.5);
  }

  // ==========================================================================
  // ❌ [AI-AUDIT-BUG #4: BỎ QUA HOÀN TOÀN API GIỎ HÀNG POST /api/cart]
  // AI nhảy cóc từ xem chi tiết sang checkout, bỏ qua bước thêm sản phẩm vào giỏ hàng.
  // ==========================================================================
  const res = http.post(
    `${BASE_URL}/api/checkout`,
    JSON.stringify(buildCheckoutPayload(ids, couponApplied)),
    { headers: authHeaders(), tags: { endpoint: 'checkout' } },
  );
  const ok = check(res, {
    'checkout: status 200/201': (r) => r.status === 200 || r.status === 201,
  });
  if (!ok) businessErrors.add(1);

  // Users usually land on their orders page after paying
  const orders = http.get(`${BASE_URL}/api/orders/my-orders`, {
    headers: authHeaders(),
    tags: { endpoint: 'my_orders' },
  });
  check(orders, { 'my-orders: status 200': (r) => r.status === 200 });
}

// -------------------------------------------------------------- main loop --
export default function (data) {
  if (firstIteration) {
    sleep(Math.random() * 5);   // stagger so 50 VUs don't all log in on the same ms
    firstIteration = false;
  }
  if (!token) login();

  const r = Math.random();
  if (r < MIX.browse) {
    browse();
  } else if (r < MIX.browse + MIX.detail) {
    productDetail(data.productIds);
  } else {
    checkoutFlow(data.productIds);
  }

  sleep(Math.random() * 2 + 1);  // think time: 1–3 s
}
