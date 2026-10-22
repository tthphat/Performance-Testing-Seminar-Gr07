# Phụ lục A - AI Audit Report

CS423 / CSC13003 - Kiểm chứng Phần mềm (AI-augmented · 2026) - Biểu mẫu 5 mục cho mỗi artifact

## 1. Thông tin sinh viên

| Mục | Giá trị |
|---|---|
| Họ tên sinh viên (in hoa) | TRUONG THANH PHAT |
| MSSV | 23120319 |
| Lớp / Khoá | Seminar Nhom 07 |
| Mã bài tập | Seminar-T05 Performance Testing |
| Ngày làm bài | 23/10/2026 |
| Công cụ AI đã dùng | Antigravity Assistant, Antigravity Assistant + Node.js Seeder, Claude 3.7 Sonnet, Claude 3.7 Sonnet + Human Audit |
| Có dùng AI | [x] Có [ ] Không |

## 2. Hướng dẫn
Mỗi artifact do AI sinh có một mục bên dưới, gồm: (1) prompt + công cụ, (2) output AI, (3) verdict, (4) lý do (dẫn chiếu slide/ISTQB/RFC), (5) bản sinh viên sửa. Prompt và output được dán nguyên văn.

## 3. Bảng audit - 1 mục / artifact

| # | Bước | Công cụ | Verdict |
|---|---|---|---|
| A01 | Performance Testing / k6 Baseline Script / Milestone M4 | Claude 3.7 Sonnet | INCOMPLETE |
| A02 | Performance Testing / k6 Refined Script / Milestone M4 | Claude 3.7 Sonnet + Human Audit | VALID |
| A03 | Performance Testing / Data-Driven Testing / Milestone M2 | Antigravity Assistant + Node.js Seeder | VALID |
| A04 | Performance Testing / Smoke Test Script / Milestone M3 | Antigravity Assistant | VALID |
| A05 | Documentation / k6 Execution Guide / Milestone M2 | Antigravity Assistant | VALID |
| A06 | Performance Testing / Baseline Load Script / Milestone M3 | Antigravity Assistant | VALID |
| A07 | Performance Testing / Spike Test Script / Milestone M3 | Antigravity Assistant | VALID |
| A08 | Performance Testing / 1-Page SLO Report / Milestone M5 | Antigravity Assistant | VALID |

### Artifact A01 - Performance Testing / k6 Baseline Script / Milestone M4

**(1) Prompt + Công cụ** - Tool: Claude 3.7 Sonnet - Thời gian: 21:35 22/10/2026

````text
I am performance testing an EShop backend (Node.js + SQLite) running at http://localhost:3000 using Grafana k6. Here are the main APIs: POST /api/login, GET /api/products?search=..., GET /api/products/:id, POST /api/apply-coupon, POST /api/checkout, GET /api/orders/my-orders. Write a realistic mixed-workload k6 script for a baseline load of 50 VUs for 5 minutes with distribution: 70% search/list, 25% product detail, and 5% checkout. Include SLO thresholds: P95 < 500ms and error rate < 1%.
````

**(2) Output AI**

````text
// EShop baseline mixed workload — Grafana k6
// Run:  k6 run eshop_mixed_load.js
// Opt:  k6 run -e BASE_URL=http://localhost:3000 -e COUPON_CODE=SAVE10 eshop_mixed_load.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

// ---------------------------------------------------------------- config ---
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const EMAIL = __ENV.USER_EMAIL || 'test@eshop.com';        // from your HAR
const PASSWORD = __ENV.USER_PASSWORD || 'Test1234!';       // from your HAR
const COUPON_CODE = __ENV.COUPON_CODE || '';               // leave empty to skip apply-coupon

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

// ASSUMPTION: checkout/apply-coupon/my-orders payloads were not in the HAR.
// Adjust buildCheckoutPayload() to match your real API contract.
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

  if (COUPON_CODE) {
    const c = http.post(
      `${BASE_URL}/api/apply-coupon`,
      JSON.stringify({ code: COUPON_CODE }),   // ASSUMPTION: body field name
      { headers: authHeaders(), tags: { endpoint: 'apply_coupon' } },
    );
    couponApplied = check(c, { 'coupon: status 200': (r) => r.status === 200 });
    sleep(Math.random() * 1 + 0.5);
  }

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
````

**(3) Verdict:** INCOMPLETE

**(4) Lý do (ISTQB / slide):** Sai cấu trúc payload POST /api/checkout (dùng camelCase shippingAddress và thiếu total_amount khiến DB lưu NULL, vi phạm đặc tả API Specification Section 4.3) và POST /api/apply-coupon (thiếu total_amount khiến backend trả về HTTP 400, vi phạm Section 5.1).

**(5) Bản sinh viên sửa:**

````text
Sửa payload checkout thành { total_amount, shipping_address } và apply-coupon thành { code, total_amount, user_id }, bổ sung CSV data-driven và API giỏ hàng trong ai_audited_refined.js.
````

### Artifact A02 - Performance Testing / k6 Refined Script / Milestone M4

**(1) Prompt + Công cụ** - Tool: Claude 3.7 Sonnet + Human Audit - Thời gian: 21:54 22/10/2026

````text
Refine ai_generated_raw.js into ai_audited_refined.js by fixing API payloads (checkout, apply-coupon), adding /api/cart flow, extracting dynamic userId from login response, and applying realistic think times and thresholds.
````

**(2) Output AI**

````text
﻿// ============================================================================
// EShop Baseline Mixed Workload - Audited & Refined k6 Script (Milestone M4)
// Student: Truong Thanh Phat (23120319) - Group 07
// ============================================================================
// Fixes applied after AI Critical Audit on ai_generated_raw.js:
// 1. [Fix Payload] POST /api/checkout -> snake_case: { total_amount, shipping_address }
// 2. [Fix Payload] POST /api/apply-coupon -> { code, total_amount, user_id } with total > min_order_amount
// 3. [Feature Coverage] Added POST /api/cart flow before checkout
// 4. [Dynamic State] Extract dynamic user.id from login response (no hardcoded user_id: 1)
// 5. [Concurrency Safe] Single login per VU with staggered ramp-up sleep
// ============================================================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------- CONFIG ---
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const DEFAULT_EMAIL = __ENV.USER_EMAIL || 'test@eshop.com';
const DEFAULT_PASSWORD = __ENV.USER_PASSWORD || 'Test1234!';
const COUPON_CODE = __ENV.COUPON_CODE || 'SAVE10';

// Workload mix: 70% Search/Browse, 25% Product Detail, 5% Cart & Checkout
const MIX = {
  browse: 0.70,
  detail: 0.25,
  // Remaining 0.05 is checkout
};

const KEYWORDS = ['iphone', 'samsung', 'macbook', 'airpods', 'keychron', 'pro'];
const FALLBACK_PRODUCTS = [
  { id: 1, name: 'iPhone 15 Pro Max', price: 30000000 },
  { id: 2, name: 'Samsung Galaxy S24 Ultra', price: 28000000 },
  { id: 3, name: 'MacBook Pro M3', price: 45000000 },
  { id: 4, name: 'Tai nghe AirPods Pro 2', price: 6000000 },
  { id: 5, name: 'Ban phim co Keychron Q1', price: 4000000 },
];

// Custom Metrics
const businessErrors = new Counter('business_errors');
const checkoutSuccessRate = new Rate('checkout_success_rate');
const checkoutDuration = new Trend('checkout_flow_duration');

// --------------------------------------------------------------- OPTIONS ---
export const options = {
  scenarios: {
    baseline_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },  // Ramp-up to 50 VUs
        { duration: '4m', target: 50 },   // Steady state baseline load
        { duration: '30s', target: 0 },   // Graceful ramp-down
      ],
      gracefulStop: '30s',
    },
  },
  thresholds: {
    // Global SLOs (Milestone M5 Requirements)
    http_req_duration: ['p(95)<500'], // P95 latency < 500ms
    http_req_failed: ['rate<0.01'],   // HTTP error rate < 1%
    checks: ['rate>0.99'],            // Assertion success rate > 99%

    // Per-Endpoint Latency SLOs
    'http_req_duration{endpoint:login}': ['p(95)<500'],
    'http_req_duration{endpoint:search}': ['p(95)<500'],
    'http_req_duration{endpoint:product_detail}': ['p(95)<500'],
    'http_req_duration{endpoint:add_to_cart}': ['p(95)<500'],
    'http_req_duration{endpoint:apply_coupon}': ['p(95)<500'],
    'http_req_duration{endpoint:checkout}': ['p(95)<500'],
    'http_req_duration{endpoint:my_orders}': ['p(95)<500'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'max'],
};

// ----------------------------------------------------------------- SETUP ---
// Pre-flight check: Discover actual catalog data so VUs always query valid products
export function setup() {
  const res = http.get(`${BASE_URL}/api/products?search=`, {
    tags: { endpoint: 'setup_catalog' },
  });
  let products = FALLBACK_PRODUCTS;
  try {
    const list = res.json();
    if (Array.isArray(list) && list.length > 0) {
      products = list;
    }
  } catch (_) {
    console.warn('Could not parse live products list, using fallback product list.');
  }
  return { products };
}

// ------------------------------------------------------------- VU STATE ---
// VU-scoped variables: each virtual user maintains its own session
let token = null;
let currentUserId = null;
let isFirstRun = true;

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function login(email, password) {
  const payload = JSON.stringify({ email, password });
  const res = http.post(`${BASE_URL}/api/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'login' },
  });

  const ok = check(res, {
    'login: status 200': (r) => r.status === 200,
    'login: has token': (r) => !!r.json('token'),
  });

  if (ok) {
    token = res.json('token');
    const user = res.json('user');
    currentUserId = user ? user.id : 2;
  } else {
    token = null;
    currentUserId = null;
    businessErrors.add(1);
  }
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ----------------------------------------------------- WORKLOAD ACTIONS ---
function browseProducts() {
  const q = Math.random() < 0.3 ? '' : pick(KEYWORDS);
  const res = http.get(`${BASE_URL}/api/products?search=${encodeURIComponent(q)}`, {
    headers: authHeaders(),
    tags: { endpoint: 'search' },
  });

  check(res, {
    'search: status 200': (r) => r.status === 200,
    'search: valid json array': (r) => Array.isArray(r.json()),
  });
}

function viewProductDetail(products) {
  const item = pick(products);
  const res = http.get(`${BASE_URL}/api/products/${item.id}`, {
    headers: authHeaders(),
    tags: { endpoint: 'product_detail' },
  });

  check(res, {
    'detail: status 200': (r) => r.status === 200,
    'detail: id matches': (r) => r.json('id') === item.id,
  });
}

function fullCheckoutFlow(products) {
  const startFlowTime = Date.now();
  const item = pick(products);
  const itemPrice = item.price || 500000;

  // 1. Add product to cart
  const cartPayload = JSON.stringify({
    id: item.id,
    name: item.name,
    price: itemPrice,
    quantity: 1,
  });
  const cartRes = http.post(`${BASE_URL}/api/cart`, cartPayload, {
    headers: authHeaders(),
    tags: { endpoint: 'add_to_cart' },
  });
  check(cartRes, {
    'cart: status 200': (r) => r.status === 200,
  });

  sleep(0.5); // Micro pause between user actions

  // 2. Apply Coupon (Ensuring total_amount > coupon.min_order_amount)
  let finalAmount = itemPrice;
  if (COUPON_CODE && itemPrice >= 300000) {
    const couponPayload = JSON.stringify({
      code: COUPON_CODE,
      total_amount: itemPrice,
      user_id: currentUserId,
    });
    const couponRes = http.post(`${BASE_URL}/api/apply-coupon`, couponPayload, {
      headers: authHeaders(),
      tags: { endpoint: 'apply_coupon' },
    });

    const couponOk = check(couponRes, {
      'coupon: status 200': (r) => r.status === 200,
      'coupon: has discount': (r) => r.json('discount_amount') !== undefined,
    });

    if (couponOk && couponRes.json('final_amount')) {
      finalAmount = couponRes.json('final_amount');
    }
  }

  sleep(0.5);

  // 3. Checkout with exact backend snake_case contract
  const checkoutPayload = JSON.stringify({
    total_amount: finalAmount,
    shipping_address: '123 Nguyen Trai, Phuong 4, Quan 5, TP.HCM',
  });

  const checkoutRes = http.post(`${BASE_URL}/api/checkout`, checkoutPayload, {
    headers: authHeaders(),
    tags: { endpoint: 'checkout' },
  });

  const isCheckoutOk = check(checkoutRes, {
    'checkout: status 200': (r) => r.status === 200,
    'checkout: has orderId': (r) => r.json('orderId') !== undefined,
  });

  checkoutSuccessRate.add(isCheckoutOk);
  if (!isCheckoutOk) {
    businessErrors.add(1);
  }

  // 4. View My Orders page right after purchasing
  const ordersRes = http.get(`${BASE_URL}/api/orders/my-orders`, {
    headers: authHeaders(),
    tags: { endpoint: 'my_orders' },
  });

  check(ordersRes, {
    'my-orders: status 200': (r) => r.status === 200,
    'my-orders: contains list': (r) => Array.isArray(r.json()),
  });

  checkoutDuration.add(Date.now() - startFlowTime);
}

// ----------------------------------------------------------- MAIN LOOP ---
export default function (data) {
  // Stagger startup across VUs to avoid instant spike on iteration 0
  if (isFirstRun) {
    sleep(Math.random() * 4);
    isFirstRun = false;
  }

  // Authenticate once per VU session
  if (!token) {
    login(DEFAULT_EMAIL, DEFAULT_PASSWORD);
  }

  // Weighted random distribution matching EShop workload model
  const r = Math.random();
  if (r < MIX.browse) {
    browseProducts();
  } else if (r < MIX.browse + MIX.detail) {
    viewProductDetail(data.products);
  } else {
    fullCheckoutFlow(data.products);
  }

  // Jittered think time between 1s and 3s (Poisson-like simulation)
  sleep(Math.random() * 2 + 1);
}
````

**(3) Verdict:** VALID

**(4) Lý do (ISTQB / slide):** Đã đối chiếu trực tiếp với backend/server.js: sửa payload checkout sang snake_case { total_amount, shipping_address } theo API Spec Mục 4.3; sửa apply-coupon sang { code, total_amount, user_id } và đảm bảo total_amount >= min_order_amount theo Mục 5.1; bổ sung luồng /api/cart; trích xuất dynamic user.id từ kết quả login; cấu hình ramping-vus và thresholds P95 < 500ms.

**(5) Bản sinh viên sửa:**

````text
Bản hoàn chỉnh đã được lưu tại k6-eshop/ai_audited_refined.js và sẵn sàng thực thi.
````

### Artifact A03 - Performance Testing / Data-Driven Testing / Milestone M2

**(1) Prompt + Công cụ** - Tool: Antigravity Assistant + Node.js Seeder - Thời gian: 22:06 22/10/2026

````text
Chuẩn bị dữ liệu Data-Driven (users.csv) bạn thực hiện đi
````

**(2) Output AI**

````text
email,password,id
test@eshop.com,Test1234!,2
user1@eshop.com,Test1234!,3
user2@eshop.com,Test1234!,4
user3@eshop.com,Test1234!,5
user4@eshop.com,Test1234!,6
user5@eshop.com,Test1234!,7
user6@eshop.com,Test1234!,8
user7@eshop.com,Test1234!,9
user8@eshop.com,Test1234!,10
user9@eshop.com,Test1234!,11
user10@eshop.com,Test1234!,12
user11@eshop.com,Test1234!,13
user12@eshop.com,Test1234!,14
user13@eshop.com,Test1234!,15
user14@eshop.com,Test1234!,16
user15@eshop.com,Test1234!,17
user16@eshop.com,Test1234!,18
user17@eshop.com,Test1234!,19
user18@eshop.com,Test1234!,20
user19@eshop.com,Test1234!,21
user20@eshop.com,Test1234!,22
user21@eshop.com,Test1234!,23
user22@eshop.com,Test1234!,24
user23@eshop.com,Test1234!,25
user24@eshop.com,Test1234!,26
user25@eshop.com,Test1234!,27
user26@eshop.com,Test1234!,28
user27@eshop.com,Test1234!,29
user28@eshop.com,Test1234!,30
user29@eshop.com,Test1234!,31
user30@eshop.com,Test1234!,32
user31@eshop.com,Test1234!,33
user32@eshop.com,Test1234!,34
user33@eshop.com,Test1234!,35
user34@eshop.com,Test1234!,36
user35@eshop.com,Test1234!,37
user36@eshop.com,Test1234!,38
user37@eshop.com,Test1234!,39
user38@eshop.com,Test1234!,40
user39@eshop.com,Test1234!,41
user40@eshop.com,Test1234!,42
user41@eshop.com,Test1234!,43
user42@eshop.com,Test1234!,44
user43@eshop.com,Test1234!,45
user44@eshop.com,Test1234!,46
user45@eshop.com,Test1234!,47
user46@eshop.com,Test1234!,48
user47@eshop.com,Test1234!,49
user48@eshop.com,Test1234!,50
user49@eshop.com,Test1234!,51
user50@eshop.com,Test1234!,52
user51@eshop.com,Test1234!,53
user52@eshop.com,Test1234!,54
user53@eshop.com,Test1234!,55
user54@eshop.com,Test1234!,56
user55@eshop.com,Test1234!,57
user56@eshop.com,Test1234!,58
user57@eshop.com,Test1234!,59
user58@eshop.com,Test1234!,60
user59@eshop.com,Test1234!,61
user60@eshop.com,Test1234!,62
user61@eshop.com,Test1234!,63
user62@eshop.com,Test1234!,64
user63@eshop.com,Test1234!,65
user64@eshop.com,Test1234!,66
user65@eshop.com,Test1234!,67
user66@eshop.com,Test1234!,68
user67@eshop.com,Test1234!,69
user68@eshop.com,Test1234!,70
user69@eshop.com,Test1234!,71
user70@eshop.com,Test1234!,72
user71@eshop.com,Test1234!,73
user72@eshop.com,Test1234!,74
user73@eshop.com,Test1234!,75
user74@eshop.com,Test1234!,76
user75@eshop.com,Test1234!,77
user76@eshop.com,Test1234!,78
user77@eshop.com,Test1234!,79
user78@eshop.com,Test1234!,80
user79@eshop.com,Test1234!,81
user80@eshop.com,Test1234!,82
user81@eshop.com,Test1234!,83
user82@eshop.com,Test1234!,84
user83@eshop.com,Test1234!,85
user84@eshop.com,Test1234!,86
user85@eshop.com,Test1234!,87
user86@eshop.com,Test1234!,88
user87@eshop.com,Test1234!,89
user88@eshop.com,Test1234!,90
user89@eshop.com,Test1234!,91
user90@eshop.com,Test1234!,92
user91@eshop.com,Test1234!,93
user92@eshop.com,Test1234!,94
user93@eshop.com,Test1234!,95
user94@eshop.com,Test1234!,96
user95@eshop.com,Test1234!,97
user96@eshop.com,Test1234!,98
user97@eshop.com,Test1234!,99
user98@eshop.com,Test1234!,100
user99@eshop.com,Test1234!,101
user100@eshop.com,Test1234!,102
````

**(3) Verdict:** VALID

**(4) Lý do (ISTQB / slide):** Đã tạo và seed thành công 101 tài khoản người dùng vào database.sqlite và xuất file k6-eshop/users.csv đồng bộ. Đáp ứng đầy đủ yêu cầu Data-Driven Testing (Milestone M2) theo Seminar Guide, giúp cấp phát tài khoản độc lập cho từng Virtual User (VU) để tránh tranh chấp lock SQLite và vượt giới hạn mã giảm giá.

**(5) Bản sinh viên sửa:**

````text
File users.csv đã sẵn sàng tại k6-eshop/users.csv với đầy đủ các cột email, password, id.
````

### Artifact A04 - Performance Testing / Smoke Test Script / Milestone M3

**(1) Prompt + Công cụ** - Tool: Antigravity Assistant - Thời gian: 22:21 22/10/2026

````text
tạo từng kịch bản 1 (Kịch bản 1: smoke_test.js)
````

**(2) Output AI**

````text
﻿// ============================================================================
// Kịch bản 1: Smoke Test (smoke_test.js) - EShop Performance Testing
// Student: Truong Thanh Phat (23120319) - Nhóm 07
// ============================================================================
// Mục tiêu: Kiểm tra nhanh tính đúng đắn của toàn bộ 7 API trên EShop thật:
// 1. POST /api/login (Xác thực & lấy JWT Token từ users.csv)
// 2. GET  /api/products?search=... (Tìm kiếm danh sách sản phẩm)
// 3. GET  /api/products/:id (Xem chi tiết sản phẩm)
// 4. POST /api/cart (Thêm sản phẩm vào giỏ hàng)
// 5. POST /api/apply-coupon (Áp dụng mã giảm giá SAVE10)
// 6. POST /api/checkout (Đặt hàng thành công)
// 7. GET  /api/orders/my-orders (Kiểm tra lịch sử đơn hàng)
//
// Cấu hình: 1 VU chạy tuần tự trong 1 phút (hoặc tối đa 10 iterations)
// ============================================================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// ---------------------------------------------------------------- CONFIG ---
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const COUPON_CODE = __ENV.COUPON_CODE || 'SAVE10';

// Đọc dữ liệu tài khoản từ users.csv bằng SharedArray (Data-driven testing)
const users = new SharedArray('eshop_users', function () {
  const fileContent = open('./users.csv');
  const lines = fileContent.split('\n').slice(1).filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const [email, password, id] = line.trim().split(',');
    return { email, password, id: parseInt(id) };
  });
});

export const options = {
  scenarios: {
    smoke_test: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
      gracefulStop: '10s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% requests phải phản hồi dưới 500ms
    http_req_failed: ['rate==0'],     // Smoke test không được phép có bất kỳ request lỗi nào (0%)
    checks: ['rate==1.0'],            // Tất cả checkpoints phải đạt 100%
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'max'],
};

// ----------------------------------------------------------------- SETUP ---
export function setup() {
  console.log(`[Setup] Đang kiểm tra kết nối tới EShop tại ${BASE_URL}...`);
  const res = http.get(`${BASE_URL}/api/products?search=`, {
    tags: { endpoint: 'setup' },
  });
  
  let products = [
    { id: 1, name: 'iPhone 15 Pro Max', price: 30000000 },
    { id: 2, name: 'Samsung Galaxy S24 Ultra', price: 28000000 },
  ];

  try {
    const list = res.json();
    if (Array.isArray(list) && list.length > 0) {
      products = list;
      console.log(`[Setup] Tìm thấy ${products.length} sản phẩm thực tế trong catalog.`);
    }
  } catch (_) {
    console.warn('[Setup] Không parse được catalog, dùng sản phẩm mẫu fallback.');
  }

  return { products };
}

// ------------------------------------------------------------- MAIN TEST ---
export default function (data) {
  // Lấy tài khoản test từ users.csv cấp cho VU hiện tại
  const currentUser = users[(__VU - 1) % users.length];

  // 1. POST /api/login
  const loginPayload = JSON.stringify({
    email: currentUser.email,
    password: currentUser.password,
  });

  const loginRes = http.post(`${BASE_URL}/api/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'login' },
  });

  const isLoginOk = check(loginRes, {
    '[1. Login] status 200': (r) => r.status === 200,
    '[1. Login] có JWT token': (r) => r.json('token') !== undefined && r.json('token').length > 10,
  });

  if (!isLoginOk) {
    console.error(`Login thất bại cho user: ${currentUser.email}`);
    sleep(1);
    return;
  }

  const token = loginRes.json('token');
  const userId = loginRes.json('user.id') || currentUser.id;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  sleep(0.5);

  // 2. GET /api/products?search=
  const searchRes = http.get(`${BASE_URL}/api/products?search=phone`, {
    headers: authHeaders,
    tags: { endpoint: 'search' },
  });

  check(searchRes, {
    '[2. Search] status 200': (r) => r.status === 200,
    '[2. Search] trả về mảng sản phẩm': (r) => Array.isArray(r.json()),
  });

  sleep(0.5);

  // 3. GET /api/products/:id
  const selectedProduct = data.products[0];
  const detailRes = http.get(`${BASE_URL}/api/products/${selectedProduct.id}`, {
    headers: authHeaders,
    tags: { endpoint: 'product_detail' },
  });

  check(detailRes, {
    '[3. Detail] status 200': (r) => r.status === 200,
    '[3. Detail] ID sản phẩm khớp': (r) => r.json('id') === selectedProduct.id,
  });

  sleep(0.5);

  // 4. POST /api/cart
  const cartPayload = JSON.stringify({
    id: selectedProduct.id,
    name: selectedProduct.name,
    price: selectedProduct.price,
    quantity: 1,
  });

  const cartRes = http.post(`${BASE_URL}/api/cart`, cartPayload, {
    headers: authHeaders,
    tags: { endpoint: 'add_to_cart' },
  });

  check(cartRes, {
    '[4. Cart] status 200': (r) => r.status === 200,
  });

  sleep(0.5);

  // 5. POST /api/apply-coupon
  let finalAmount = selectedProduct.price;
  const couponPayload = JSON.stringify({
    code: COUPON_CODE,
    total_amount: selectedProduct.price,
    user_id: userId,
  });

  const couponRes = http.post(`${BASE_URL}/api/apply-coupon`, couponPayload, {
    headers: authHeaders,
    tags: { endpoint: 'apply_coupon' },
  });

  const isCouponOk = check(couponRes, {
    '[5. Coupon] status 200': (r) => r.status === 200,
    '[5. Coupon] có số tiền giảm': (r) => r.json('discount_amount') !== undefined,
  });

  if (isCouponOk && couponRes.json('final_amount')) {
    finalAmount = couponRes.json('final_amount');
  }

  sleep(0.5);

  // 6. POST /api/checkout
  const checkoutPayload = JSON.stringify({
    total_amount: finalAmount,
    shipping_address: '123 Nguyen Trai, Phuong 4, Quan 5, TP.HCM',
  });

  const checkoutRes = http.post(`${BASE_URL}/api/checkout`, checkoutPayload, {
    headers: authHeaders,
    tags: { endpoint: 'checkout' },
  });

  check(checkoutRes, {
    '[6. Checkout] status 200': (r) => r.status === 200,
    '[6. Checkout] có mã đơn hàng orderId': (r) => r.json('orderId') !== undefined,
  });

  sleep(0.5);

  // 7. GET /api/orders/my-orders
  const ordersRes = http.get(`${BASE_URL}/api/orders/my-orders`, {
    headers: authHeaders,
    tags: { endpoint: 'my_orders' },
  });

  check(ordersRes, {
    '[7. Orders] status 200': (r) => r.status === 200,
    '[7. Orders] danh sách đơn hàng hợp lệ': (r) => Array.isArray(r.json()) && r.json().length > 0,
  });

  // Nghỉ giữa các vòng lặp kiểm thử
  sleep(1);
}
````

**(3) Verdict:** VALID

**(4) Lý do (ISTQB / slide):** Kịch bản Smoke Test kiểm tra toàn bộ 7 API tuần tự từ Login đến My-Orders, tích hợp Data-Driven users.csv qua SharedArray, gắn tag endpoint cho từng request và kiểm tra 100% assertions.

**(5) Bản sinh viên sửa:**

````text
File k6-eshop/smoke_test.js đã được tạo hoàn chỉnh và sẵn sàng thực thi.
````

### Artifact A05 - Documentation / k6 Execution Guide / Milestone M2

**(1) Prompt + Công cụ** - Tool: Antigravity Assistant - Thời gian: 22:42 22/10/2026

````text
@k6-eshop/k6-guide.md viet phan giai thich vao day
````

**(2) Output AI**

````text
﻿# SỔ TAY HƯỚNG DẪN THỰC THI KIỂM THỬ HIỆU NĂNG VỚI GRAFANA K6 (ESHOP SUT)

* **Môn học:** Software Testing (CS423 / CSC15003) – FIT@HCMUS
* **Chủ đề:** T05 - Performance Testing (Nhóm 07)
* **Người phụ trách k6:** Trương Thành Phát (23120319) – Technical & AI Lead
* **Hệ thống kiểm thử (SUT):** EShop (Node.js + SQLite backend tại `http://localhost:3000`)

---

## 1. Các khái niệm cốt lõi trong Grafana k6

Khi thực hiện kiểm thử hiệu năng với k6, bạn cần nắm vững 4 khái niệm nền tảng sau:

1. **Virtual User (VU - Người dùng ảo):**
   * Mỗi VU tương đương với một tiến trình/luồng chạy song song độc lập, mô phỏng hành vi của một khách hàng thật đang truy cập trang web.
   * Các VU hoạt động đồng thời (concurrently) để tạo áp lực tải lên hệ thống.
2. **Iteration (Vòng lặp thực thi):**
   * Trong k6, mã nguồn hành vi người dùng được định nghĩa bên trong hàm `export default function () { ... }`.
   * **1 Iteration** được tính là **một lần người dùng thực hiện trọn vẹn toàn bộ các bước từ dòng đầu tiên đến dòng cuối cùng của hàm `default`**.
   * Ví dụ: Người dùng mở trang web $\rightarrow$ Đăng nhập $\rightarrow$ Tìm kiếm sản phẩm $\rightarrow$ Xem chi tiết $\rightarrow$ Thêm vào giỏ hàng $\rightarrow$ Áp mã giảm giá $\rightarrow$ Đặt hàng $\rightarrow$ Xem lịch sử đơn. Khi kết thúc bước xem lịch sử đơn, người đó đã hoàn thành **1 Iteration**. Nếu k6 tiếp tục chạy, chu trình sẽ lặp lại từ bước 1 (Iteration 2).
3. **Checks (Điểm kiểm tra / Assertions):**
   * Hoạt động giống như câu lệnh `assert`, dùng để xác thực xem phản hồi của server có đúng kỳ vọng hay không (ví dụ: HTTP status là 200, có chứa chuỗi JWT token, trả về đúng định dạng mảng JSON).
   * **Lưu ý:** Khác với unit test thông thường, khi một `check` bị thất bại (Failed), k6 **không dừng kịch bản lại** mà chỉ ghi nhận tỷ lệ lỗi để tiếp tục kiểm tra các bước sau.
4. **Thresholds (Ngưỡng tiêu chí SLO):**
   * Tiêu chuẩn Pass/Fail tổng thể của toàn bộ bài test (ví dụ: $P95 < 500\text{ ms}$, tỷ lệ lỗi $< 1\%$). Khi bài test kết thúc, nếu có bất kỳ tiêu chí nào vượt ngưỡng, k6 sẽ đánh dấu bài test là thất bại (exit code khác 0).

---

## 2. Kịch bản 1: Smoke Test (`smoke_test.js`)

### 2.1. Bản chất và Mục tiêu của Smoke Test
* **Nguồn gốc thuật ngữ:** Bắt nguồn từ kỹ thuật phần cứng: khi vừa lắp ráp một bo mạch mới, kỹ sư sẽ cắm nguồn điện để kiểm tra xem bo mạch có bị chập cháy, **"bốc khói"** hay không trước khi tiến hành đo đạc các thông số chi tiết.
* **Trong kiểm thử hiệu năng:** Smoke Test được thực thi với **mức tải tối thiểu (1 Virtual User)** trước khi chạy bất kỳ bài test tải nặng nào (Baseline 50 VUs hay Spike 500 VUs).
* **Mục tiêu chính:**
  1. Kiểm tra tính sẵn sàng (Health check) của Backend EShop.
  2. Xác minh tính đúng đắn của toàn bộ luồng kịch bản (kịch bản không bị lỗi cú pháp, không gọi sai endpoint, không bị đứt đoạn giữa chừng).
  3. Đảm bảo toàn bộ 7 API mục tiêu đều hoạt động và trả về HTTP 200.

---

### 2.2. Chu trình 7 bước nghiệp vụ trong `smoke_test.js`

File `smoke_test.js` mô phỏng 1 người dùng thực hiện tuần tự chuỗi 7 hành động:

| Bước | API Endpoint | Phương thức | Dữ liệu truyền lên | Checkpoints kiểm tra |
| :---: | :--- | :---: | :--- | :--- |
| **1** | `/api/login` | `POST` | `email`, `password` (lấy từ file `users.csv`) | Status 200; Trả về chuỗi JWT `token` hợp lệ. |
| **2** | `/api/products?search=phone` | `GET` | Header `Authorization: Bearer <token>` | Status 200; Kết quả là một danh sách mảng JSON. |
| **3** | `/api/products/:id` | `GET` | Header `Authorization` | Status 200; ID sản phẩm trả về trùng khớp ID đã chọn. |
| **4** | `/api/cart` | `POST` | `{ id, name, price, quantity: 1 }` | Status 200 (Thêm sản phẩm vào giỏ thành công). |
| **5** | `/api/apply-coupon` | `POST` | `{ code: 'SAVE10', total_amount, user_id }` | Status 200; Có trường `discount_amount` tính tiền giảm. |
| **6** | `/api/checkout` | `POST` | `{ total_amount, shipping_address }` | Status 200; Nhận được mã đơn hàng `orderId`. |
| **7** | `/api/orders/my-orders` | `GET` | Header `Authorization` | Status 200; Danh sách đơn hàng cá nhân có $\ge 1$ đơn. |

---

### 2.3. Hướng dẫn thực thi: Sự khác biệt giữa 2 lựa chọn chạy k6

Trước khi chạy, hãy mở terminal và di chuyển vào thư mục chứa script:
```bash
cd "d:\HCMUS\semester7\software-testing\Performance-Testing-Seminar-Gr07\k6-eshop"
```

Bạn có thể chạy kịch bản theo 2 chế độ:

#### **Lựa chọn A: Chạy nhanh 1 vòng lặp (Khuyên dùng khi Debug / Kiểm tra nhanh)**
```bash
k6 run --iterations 1 smoke_test.js
```
* **Cơ chế:** Cờ `--iterations 1` ghi đè cấu hình trong file, ép k6 **chỉ chạy đúng 1 vòng lặp duy nhất** rồi thoát ngay.
* **Thời gian thực hiện:** Khoảng **3 – 4 giây**.
* **Khi nào sử dụng:** Khi bạn vừa sửa code, đổi endpoint hoặc muốn kiểm tra nhanh xem server có phản hồi tốt hay không mà không muốn chờ đợi.

#### **Lựa chọn B: Chạy đầy đủ theo thời gian (Chuẩn kịch bản môn học)**
```bash
k6 run smoke_test.js
```
* **Cơ chế:** k6 đọc cấu hình `duration: '1m'` trong file script. 1 người dùng ảo (1 VU) sẽ **liên tục lặp đi lặp lại chu trình 7 bước suốt 60 giây**.
* **Thời gian thực hiện:** Đúng **1 phút** (trong 1 phút sẽ thực hiện được khoảng 12 – 15 vòng lặp mua sắm).
* **Khi nào sử dụng:** Khi chạy nghiệm thu chính thức của mốc Smoke Test để kiểm tra độ ổn định bền vững của ứng dụng khi có thao tác mua hàng liên tục.

---

### 2.4. Cách đọc và phân tích kết quả trên màn hình Terminal

Khi k6 hoàn tất, bảng tổng kết sẽ hiển thị các khối thông tin sau:

```text
  █ THRESHOLDS 
    ✓ checks...............: 'rate==1.0' rate=100.00%
    ✓ http_req_duration....: 'p(95)<500' p(95)=10.02ms
    ✓ http_req_failed......: 'rate==0'   rate=0.00%

  █ TOTAL RESULTS 
    checks_succeeded...: 100.00% (13 out of 13)
    ✓ [1. Login] status 200
    ✓ [1. Login] có JWT token
    ✓ [2. Search] status 200
    ...
```

1. **Khối THRESHOLDS (Ngưỡng chất lượng SLO):**
   * Có dấu tích xanh `✓`: Tiêu chí đạt chuẩn.
   * `checks rate=100%`: 100% các điểm kiểm tra đều đúng, không có lỗi logic nào.
   * `http_req_failed rate=0.00%`: Tỷ lệ lỗi mạng/server là 0%.
   * `http_req_duration p(95)=10.02ms`: 95% số request có thời gian phản hồi cực nhanh (10ms), vượt xa yêu cầu ($< 500\text{ ms}$).
2. **Khối TOTAL RESULTS (Chi tiết Checkpoints):**
   * Thể hiện chi tiết cả 13 tiêu chí kiểm tra tương ứng với 7 bước nghiệp vụ. Nếu bước nào bị lỗi, dòng đó sẽ hiện dấu nhân màu đỏ `✗`.

---

## 3. Cơ chế Data-Driven Testing với `users.csv`

* **Vấn đề thực tế:** Nếu tất cả các VU dùng chung 1 tài khoản (`test@eshop.com`), khi nhiều người cùng đặt hàng và áp mã giảm giá `SAVE10`, hệ thống sẽ báo lỗi `400 Đã đạt giới hạn sử dụng mã (max_uses_per_user = 1)` hoặc gây nghẽn khóa ghi SQLite.
* **Giải pháp trong script:**
  * File `users.csv` chứa 101 tài khoản độc lập đã được nạp sẵn vào cơ sở dữ liệu (`user1@eshop.com` ... `user100@eshop.com`).
  * Trong k6, thư viện `SharedArray` tải dữ liệu một lần vào bộ nhớ:
    ```javascript
    import { SharedArray } from 'k6/data';

    const users = new SharedArray('eshop_users', function () {
      return open('./users.csv').split('\n').slice(1)...;
    });
    ```
  * Cấp phát tài khoản riêng cho từng VU bằng công thức:
    ```javascript
    const currentUser = users[(__VU - 1) % users.length];
    ```
    *(VU 1 dùng user 1, VU 2 dùng user 2,... đảm bảo mỗi phiên người dùng là hoàn toàn độc lập).*
````

**(3) Verdict:** VALID

**(4) Lý do (ISTQB / slide):** Biên soạn tài liệu hướng dẫn chi tiết k6-guide.md giải thích rõ khái niệm VU, Iteration, 7 bước nghiệp vụ của Smoke Test, sự khác biệt giữa các chế độ thực thi k6 (--iterations 1 vs duration 1m), cách đọc bảng kết quả Terminal và cơ chế Data-driven SharedArray.

**(5) Bản sinh viên sửa:**

````text
Tài liệu hoàn chỉnh đã được lưu tại k6-eshop/k6-guide.md.
````

### Artifact A06 - Performance Testing / Baseline Load Script / Milestone M3

**(1) Prompt + Công cụ** - Tool: Antigravity Assistant - Thời gian: 23:08 22/10/2026

````text
bạn tạo test đi (Kịch bản 2: baseline_load.js)
````

**(2) Output AI**

````text
﻿// ============================================================================
// Kịch bản 2: Baseline Load Test (baseline_load.js)
// EShop Performance Testing - Milestone M3 & M5
// Student: Truong Thanh Phat (23120319) - Nhom 07
// ============================================================================
// Cấu hình tải chuẩn:
// - 50 Virtual Users (VUs) duy trì trong 5 phút (Ramp-up 30s -> Hold 4m -> Ramp-down 30s)
// - Mô hình phân bổ tải (Workload Model):
//   * 70% Tìm kiếm & duyệt danh sách sản phẩm (Search / Browse)
//   * 25% Xem trang chi tiết sản phẩm (Product Detail)
//   *  5% Chuỗi hành vi mua sắm (Add to Cart -> Apply Coupon -> Checkout -> My Orders)
// - Dữ liệu Data-Driven: 101 tài khoản độc lập từ users.csv qua SharedArray
// - Ngưỡng đánh giá SLO: P95 < 500ms, Tỷ lệ lỗi < 1%, Checks > 99%
// ============================================================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------- CONFIG ---
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const COUPON_CODE = __ENV.COUPON_CODE || 'SAVE10';

// Tỷ lệ phân bổ hành vi người dùng
const WORKLOAD_MIX = {
  browse: 0.70, // 70%
  detail: 0.25, // 25% (còn lại 5% là checkout flow)
};

const KEYWORDS = ['iphone', 'samsung', 'macbook', 'airpods', 'keychron', 'pro', 'tai nghe'];
const FALLBACK_PRODUCTS = [
  { id: 1, name: 'iPhone 15 Pro Max', price: 30000000 },
  { id: 2, name: 'Samsung Galaxy S24 Ultra', price: 28000000 },
  { id: 3, name: 'MacBook Pro M3', price: 45000000 },
  { id: 4, name: 'Tai nghe AirPods Pro 2', price: 6000000 },
  { id: 5, name: 'Ban phim co Keychron Q1', price: 4000000 },
];

// Nạp danh sách tài khoản từ users.csv (Data-driven testing)
const users = new SharedArray('eshop_users', function () {
  const content = open('./users.csv');
  const lines = content.split('\n').slice(1).filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const [email, password, id] = line.trim().split(',');
    return { email, password, id: parseInt(id) };
  });
});

// Custom Metrics
const businessErrors = new Counter('business_errors');
const checkoutSuccessRate = new Rate('checkout_success_rate');
const checkoutDuration = new Trend('checkout_flow_duration_ms');
const successfulOrders = new Counter('successful_orders_total');

// --------------------------------------------------------------- OPTIONS ---
export const options = {
  scenarios: {
    baseline_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 }, // Tăng tải lên 50 VUs trong 30 giây
        { duration: '4m', target: 50 },  // Duy trì ổn định 50 VUs trong 4 phút
        { duration: '30s', target: 0 },  // Giảm tải dần về 0 trong 30 giây
      ],
      gracefulStop: '30s',
    },
  },
  thresholds: {
    // Ngưỡng SLO toàn hệ thống (Milestone M5)
    http_req_duration: ['p(95)<500'], // P95 toàn cục < 500ms
    http_req_failed: ['rate<0.01'],   // Tỷ lệ lỗi HTTP < 1%
    checks: ['rate>0.99'],            // Tỷ lệ assertions thành công > 99%

    // Ngưỡng chi tiết theo từng API Endpoint
    'http_req_duration{endpoint:login}': ['p(95)<500'],
    'http_req_duration{endpoint:search}': ['p(95)<500'],
    'http_req_duration{endpoint:product_detail}': ['p(95)<500'],
    'http_req_duration{endpoint:add_to_cart}': ['p(95)<500'],
    'http_req_duration{endpoint:apply_coupon}': ['p(95)<500'],
    'http_req_duration{endpoint:checkout}': ['p(95)<500'],
    'http_req_duration{endpoint:my_orders}': ['p(95)<500'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// ----------------------------------------------------------------- SETUP ---
export function setup() {
  console.log(`[Setup] Bắt đầu khởi tạo dữ liệu Baseline Load tại ${BASE_URL}...`);
  const res = http.get(`${BASE_URL}/api/products?search=`, {
    tags: { endpoint: 'setup' },
  });

  let products = FALLBACK_PRODUCTS;
  try {
    const list = res.json();
    if (Array.isArray(list) && list.length > 0) {
      products = list;
      console.log(`[Setup] Đã nạp thành công ${products.length} sản phẩm thực tế từ CSDL.`);
    }
  } catch (_) {
    console.warn('[Setup] Không parse được catalog, dùng sản phẩm mẫu fallback.');
  }

  return { products };
}

// ------------------------------------------------------------- VU STATE ---
// Quản lý phiên riêng cho từng Virtual User (VU Scope)
let token = null;
let currentUserId = null;
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
    '[Login] có JWT token': (r) => r.json('token') !== undefined,
  });

  if (ok) {
    token = res.json('token');
    const user = res.json('user');
    currentUserId = user ? user.id : 2;
  } else {
    token = null;
    currentUserId = null;
    businessErrors.add(1);
  }
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ----------------------------------------------------- WORKLOAD ACTIONS ---

// 1. Nhóm hành vi 70%: Tìm kiếm / Xem danh sách
function actionSearch() {
  const q = Math.random() < 0.3 ? '' : pick(KEYWORDS);
  const res = http.get(`${BASE_URL}/api/products?search=${encodeURIComponent(q)}`, {
    headers: authHeaders(),
    tags: { endpoint: 'search' },
  });

  check(res, {
    '[Search] status 200': (r) => r.status === 200,
    '[Search] kết quả là mảng': (r) => Array.isArray(r.json()),
  });
}

// 2. Nhóm hành vi 25%: Xem chi tiết sản phẩm
function actionProductDetail(products) {
  const item = pick(products);
  const res = http.get(`${BASE_URL}/api/products/${item.id}`, {
    headers: authHeaders(),
    tags: { endpoint: 'product_detail' },
  });

  check(res, {
    '[Detail] status 200': (r) => r.status === 200,
    '[Detail] đúng ID sản phẩm': (r) => r.json('id') === item.id,
  });
}

// 3. Nhóm hành vi 5%: Chuỗi mua sắm & Thanh toán
function actionCheckoutFlow(products) {
  const flowStart = Date.now();
  const item = pick(products);
  const price = item.price || 500000;

  // 3.1. Thêm vào giỏ hàng
  const cartRes = http.post(
    `${BASE_URL}/api/cart`,
    JSON.stringify({ id: item.id, name: item.name, price: price, quantity: 1 }),
    { headers: authHeaders(), tags: { endpoint: 'add_to_cart' } }
  );

  check(cartRes, {
    '[Cart] status 200': (r) => r.status === 200,
  });

  sleep(0.5); // Tạm dừng vi mô giữa các bước thao tác

  // 3.2. Áp dụng mã giảm giá (Chỉ áp khi giá trị đủ điều kiện min_order_amount)
  let finalAmount = price;
  if (COUPON_CODE && price >= 300000) {
    const couponRes = http.post(
      `${BASE_URL}/api/apply-coupon`,
      JSON.stringify({ code: COUPON_CODE, total_amount: price, user_id: currentUserId }),
      { headers: authHeaders(), tags: { endpoint: 'apply_coupon' } }
    );

    const isCouponOk = check(couponRes, {
      '[Coupon] status 200': (r) => r.status === 200,
      '[Coupon] có số tiền giảm': (r) => r.json('discount_amount') !== undefined,
    });

    if (isCouponOk && couponRes.json('final_amount')) {
      finalAmount = couponRes.json('final_amount');
    }
  }

  sleep(0.5);

  // 3.3. Đặt hàng (Checkout)
  const checkoutRes = http.post(
    `${BASE_URL}/api/checkout`,
    JSON.stringify({
      total_amount: finalAmount,
      shipping_address: '123 Nguyen Trai, Phuong 4, Quan 5, TP.HCM',
    }),
    { headers: authHeaders(), tags: { endpoint: 'checkout' } }
  );

  const isCheckoutOk = check(checkoutRes, {
    '[Checkout] status 200': (r) => r.status === 200,
    '[Checkout] có orderId': (r) => r.json('orderId') !== undefined,
  });

  checkoutSuccessRate.add(isCheckoutOk);
  if (isCheckoutOk) {
    successfulOrders.add(1);
  } else {
    businessErrors.add(1);
  }

  // 3.4. Xem lịch sử đơn hàng vừa tạo
  const ordersRes = http.get(`${BASE_URL}/api/orders/my-orders`, {
    headers: authHeaders(),
    tags: { endpoint: 'my_orders' },
  });

  check(ordersRes, {
    '[Orders] status 200': (r) => r.status === 200,
    '[Orders] danh sách hợp lệ': (r) => Array.isArray(r.json()),
  });

  checkoutDuration.add(Date.now() - flowStart);
}

// ------------------------------------------------------------- MAIN LOOP ---
export default function (data) {
  // Phân bổ thời gian khởi động ngẫu nhiên (0 - 4s) để 50 VUs không đăng nhập cùng 1 tích tắc
  if (isFirstRun) {
    sleep(Math.random() * 4);
    isFirstRun = false;
  }

  // Mỗi VU lấy 1 tài khoản riêng từ users.csv và chỉ đăng nhập đúng 1 lần
  if (!token) {
    const user = users[(__VU - 1) % users.length];
    loginVU(user.email, user.password);
  }

  // Phân phối tỷ lệ tải theo mô hình Black Friday / ngày thường
  const rand = Math.random();
  if (rand < WORKLOAD_MIX.browse) {
    actionSearch();
  } else if (rand < WORKLOAD_MIX.browse + WORKLOAD_MIX.detail) {
    actionProductDetail(data.products);
  } else {
    actionCheckoutFlow(data.products);
  }

  // Think time ngẫu nhiên 1 - 3 giây mô phỏng thời gian suy nghĩ của người dùng thật
  sleep(Math.random() * 2 + 1);
}
````

**(3) Verdict:** VALID

**(4) Lý do (ISTQB / slide):** Kịch bản Baseline Load Test cấu hình 50 VUs trong 5 phút với phân bổ tỷ lệ thực tế 70% search, 25% detail, 5% checkout. Tích hợp 101 tài khoản từ users.csv qua SharedArray, quản lý token riêng per-VU, think time ngẫu nhiên 1-3s, và các ngưỡng SLO P95 < 500ms, Error rate < 1% theo đúng Milestone M5.

**(5) Bản sinh viên sửa:**

````text
File k6-eshop/baseline_load.js đã được tạo hoàn chỉnh và sẵn sàng thực thi.
````

### Artifact A07 - Performance Testing / Spike Test Script / Milestone M3

**(1) Prompt + Công cụ** - Tool: Antigravity Assistant - Thời gian: 23:48 22/10/2026

````text
ok tạo spike test đi (Kịch bản 3: spike_test.js)
````

**(2) Output AI**

````text
﻿// ============================================================================
// Kịch bản 3: Spike Test (spike_test.js) - EShop Performance Testing
// Student: Truong Thanh Phat (23120319) - Nhóm 07
// ============================================================================
// Mục tiêu kỹ thuật:
// - Kiểm tra khả năng chịu sốc tải đột ngột (tăng gấp 10 lần từ 50 lên 500 VUs trong 30s)
// - Kích hoạt và đo lường hiện tượng thắt cổ chai cơ sở dữ liệu:
//   "SQLite Lock Contention / SQLITE_BUSY: database is locked" khi có nhiều VU cùng ghi đơn hàng
// - Quan sát khả năng tự phục hồi (Recovery Time) của hệ thống khi giảm tải về bình thường
//
// Mô hình tải (Stages - Tổng thời gian: 5 phút):
// 1. Stage 1 (1m00s): Giữ 50 VUs (Mức tải nền bình thường)
// 2. Stage 2 (0m30s): Tăng vọt đột biến từ 50 lên 500 VUs (Spike Ramp-up)
// 3. Stage 3 (2m00s): Duy trì mức sốc tải đỉnh 500 VUs (Peak Spike)
// 4. Stage 4 (1m30s): Giảm tải dần về 0 và quan sát phục hồi (Recovery Phase)
// ============================================================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------- CONFIG ---
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const COUPON_CODE = __ENV.COUPON_CODE || 'SAVE10';

const WORKLOAD_MIX = {
  browse: 0.70, // 70% Search
  detail: 0.25, // 25% Detail
  // Còn lại 5% là Checkout
};

const KEYWORDS = ['iphone', 'samsung', 'macbook', 'airpods', 'keychron', 'pro'];
const FALLBACK_PRODUCTS = [
  { id: 1, name: 'iPhone 15 Pro Max', price: 30000000 },
  { id: 2, name: 'Samsung Galaxy S24 Ultra', price: 28000000 },
  { id: 3, name: 'MacBook Pro M3', price: 45000000 },
];

// Nạp danh sách 101 tài khoản từ users.csv
const users = new SharedArray('eshop_users', function () {
  const content = open('./users.csv');
  const lines = content.split('\n').slice(1).filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const [email, password, id] = line.trim().split(',');
    return { email, password, id: parseInt(id) };
  });
});

// Custom Metrics để bắt lỗi nghẽn SQLite và đo thời gian phục hồi
const sqliteLockErrors = new Counter('sqlite_lock_errors_total');
const checkoutFailureRate = new Rate('checkout_failure_rate');
const spikeCheckoutLatency = new Trend('spike_checkout_latency_ms');
const successfulCheckouts = new Counter('successful_checkouts_total');

// --------------------------------------------------------------- OPTIONS ---
export const options = {
  scenarios: {
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },   // 1 phút đầu: Tải bình thường 50 VUs
        { duration: '30s', target: 500 }, // Sốc tải đột ngột lên 500 VUs trong 30 giây
        { duration: '2m', target: 500 },  // Duy trì đỉnh sốc tải 500 VUs trong 2 phút
        { duration: '1m30s', target: 0 }, // Giảm tải về 0 và đo thời gian phục hồi
      ],
      gracefulStop: '30s',
    },
  },
  thresholds: {
    // Trong Spike Test, tỷ lệ lỗi và độ trễ toàn cục cho phép tăng trong giai đoạn đỉnh
    // Nhưng tỷ lệ lỗi tổng thể không được vượt quá 10%
    http_req_failed: ['rate<0.10'],
    checks: ['rate>0.90'],

    // Giám sát riêng độ trễ endpoint checkout (nơi chịu ảnh hưởng trực tiếp của khóa SQLite)
    'http_req_duration{endpoint:checkout}': ['p(95)<3000'], // Cho phép trần 3s khi nghẽn ghi
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// ----------------------------------------------------------------- SETUP ---
export function setup() {
  console.log(`[Spike Setup] Đang kiểm tra kết nối tới EShop tại ${BASE_URL}...`);
  const res = http.get(`${BASE_URL}/api/products?search=`, { tags: { endpoint: 'setup' } });
  let products = FALLBACK_PRODUCTS;
  try {
    const list = res.json();
    if (Array.isArray(list) && list.length > 0) products = list;
  } catch (_) {}
  console.log(`[Spike Setup] Chuẩn bị sốc tải 500 VUs với ${products.length} sản phẩm và ${users.length} tài khoản.`);
  return { products };
}

// ------------------------------------------------------------- VU STATE ---
let token = null;
let currentUserId = null;
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
    const user = res.json('user');
    currentUserId = user ? user.id : 2;
  }
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ----------------------------------------------------- WORKLOAD ACTIONS ---
function actionSearch() {
  const q = Math.random() < 0.3 ? '' : pick(KEYWORDS);
  const res = http.get(`${BASE_URL}/api/products?search=${encodeURIComponent(q)}`, {
    headers: authHeaders(),
    tags: { endpoint: 'search' },
  });
  check(res, { '[Search] status 200': (r) => r.status === 200 });
}

function actionProductDetail(products) {
  const item = pick(products);
  const res = http.get(`${BASE_URL}/api/products/${item.id}`, {
    headers: authHeaders(),
    tags: { endpoint: 'product_detail' },
  });
  check(res, { '[Detail] status 200': (r) => r.status === 200 });
}

function actionCheckoutFlow(products) {
  const item = pick(products);
  const price = item.price || 500000;

  // 1. Add to cart
  http.post(
    `${BASE_URL}/api/cart`,
    JSON.stringify({ id: item.id, name: item.name, price: price, quantity: 1 }),
    { headers: authHeaders(), tags: { endpoint: 'add_to_cart' } }
  );

  sleep(0.3);

  // 2. Apply Coupon
  let finalAmount = price;
  if (COUPON_CODE && price >= 300000) {
    const couponRes = http.post(
      `${BASE_URL}/api/apply-coupon`,
      JSON.stringify({ code: COUPON_CODE, total_amount: price, user_id: currentUserId }),
      { headers: authHeaders(), tags: { endpoint: 'apply_coupon' } }
    );
    if (couponRes.status === 200 && couponRes.json('final_amount')) {
      finalAmount = couponRes.json('final_amount');
    }
  }

  sleep(0.3);

  // 3. Checkout - ĐIỂM NÓNG GÂY NGHẼN KHÓA GHI SQLITE
  const startCheckout = Date.now();
  const checkoutRes = http.post(
    `${BASE_URL}/api/checkout`,
    JSON.stringify({
      total_amount: finalAmount,
      shipping_address: '123 Cao Thang, Quan 3, TP.HCM',
    }),
    { headers: authHeaders(), tags: { endpoint: 'checkout' } }
  );

  const duration = Date.now() - startCheckout;
  spikeCheckoutLatency.add(duration);

  // Bắt lỗi khóa ghi SQLite: SQLITE_BUSY hoặc lỗi 500 từ server
  const isLocked = checkoutRes.status === 500 || (checkoutRes.body && checkoutRes.body.includes('SQLITE_BUSY'));
  if (isLocked) {
    sqliteLockErrors.add(1);
    checkoutFailureRate.add(1);
    console.warn(`[SQLite Bottleneck Detected] Lỗi khóa ghi SQLite tại VU ${__VU}: HTTP ${checkoutRes.status}`);
  } else {
    const isOk = check(checkoutRes, {
      '[Checkout] status 200': (r) => r.status === 200,
    });
    checkoutFailureRate.add(isOk ? 0 : 1);
    if (isOk) successfulCheckouts.add(1);
  }

  // 4. My orders
  http.get(`${BASE_URL}/api/orders/my-orders`, {
    headers: authHeaders(),
    tags: { endpoint: 'my_orders' },
  });
}

// ------------------------------------------------------------- MAIN LOOP ---
export default function (data) {
  // Stagger startup ngẫu nhiên trong 3 giây
  if (isFirstRun) {
    sleep(Math.random() * 3);
    isFirstRun = false;
  }

  // Mỗi VU lấy 1 tài khoản từ 101 user (vòng tròn modulo khi có 500 VUs)
  if (!token) {
    const user = users[(__VU - 1) % users.length];
    loginVU(user.email, user.password);
  }

  const rand = Math.random();
  if (rand < WORKLOAD_MIX.browse) {
    actionSearch();
  } else if (rand < WORKLOAD_MIX.browse + WORKLOAD_MIX.detail) {
    actionProductDetail(data.products);
  } else {
    actionCheckoutFlow(data.products);
  }

  // Think time ngẫu nhiên 1 - 2.5 giây
  sleep(Math.random() * 1.5 + 1);
}
````

**(3) Verdict:** VALID

**(4) Lý do (ISTQB / slide):** Kịch bản Spike Test được cấu hình theo 4 giai đoạn chuẩn (50 VUs 1m -> sốc 500 VUs 30s -> duy trì 500 VUs 2m -> phục hồi 1m30s). Thiết kế tích hợp bắt lỗi nghẽn khóa ghi SQLite (SQLITE_BUSY / HTTP 500) và custom metrics sqlite_lock_errors_total, spike_checkout_latency_ms để phục vụ phân tích Bottleneck.

**(5) Bản sinh viên sửa:**

````text
File k6-eshop/spike_test.js đã được tạo hoàn chỉnh và sẵn sàng thực thi.
````

### Artifact A08 - Performance Testing / 1-Page SLO Report / Milestone M5

**(1) Prompt + Công cụ** - Tool: Antigravity Assistant - Thời gian: 00:02 23/10/2026

````text
Lập Báo cáo SLO 1 trang (SLO_Report.md) tổng hợp số liệu thực nghiệm từ Baseline Load và Spike Test
````

**(2) Output AI**

````text
﻿# BÁO CÁO SLO 1 TRANG (1-PAGE SLO REPORT)
## ĐỀ TÀI T05: PERFORMANCE TESTING – ESHOP SUT (NHÓM 07)

* **Môn học:** Software Testing (CS423 / CSC15003) – Khoa CNTT, ĐHKHTN (FIT@HCMUS)
* **Sinh viên phụ trách:** Trương Thành Phát (MSSV: 23120319) – Technical & AI Lead
* **Công cụ thực nghiệm:** Grafana k6 v2.2.0 (Native Windows CLI)
* **Hệ thống SUT:** EShop (Backend Node.js + SQLite tại `http://localhost:3000`)
* **Ngày thực hiện:** 23/10/2026

---

## 1. Bảng Ma trận Thực thi Kiểm thử (Test Execution Matrix)

| Kịch bản kiểm thử | Cấu hình Virtual Users (VUs) | Thời gian chạy | Tổng HTTP Requests | Tỷ lệ lỗi (Error Rate) | Tỷ lệ Checks đạt | Trạng thái |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Smoke Test** | 1 VU | 1 phút | 8 reqs | **0.00%** | **100% (13/13)** | **PASS** |
| **2. Baseline Load** | 50 VUs | 5 phút | 7,570 reqs | **0.00%** | **100% (14,807/14,807)** | **PASS** |
| **3. Spike Test** | 50 $\rightarrow$ 500 VUs | 5 phút | 59,621 reqs | **0.00%** | **100% (52,090/52,090)** | **PASS** |

---

## 2. Bảng Đối chiếu Tiêu chuẩn SLO Cam kết (Đối chiếu bài Baseline 50 VUs)

| Tiêu chuẩn SLO | Ngưỡng cam kết (Target SLO) | Kết quả đo thực tế (Actual) | Đánh giá | Ghi chú kỹ thuật |
| :--- | :---: | :---: | :---: | :--- |
| **Độ trễ phản hồi P95** | $\mathbf{< 500\text{ ms}}$ | **3.95 ms** | **PASS** | Vượt xa cam kết ($P95$ thực tế chỉ bằng $\approx 0.8\%$ mức trần cho phép). |
| **Tỷ lệ lỗi HTTP** | $\mathbf{< 1.0\%}$ | **0.00%** (0 / 7,570 reqs) | **PASS** | 100% các request đều phản hồi HTTP 200 thành công. |
| **Thông lượng (Throughput)** | $\mathbf{\ge 20\text{ req/s}}$ | **25.16 req/s** | **PASS** | Vượt mức thông lượng yêu cầu của bài toán EShop. |
| **Tải vi xử lý (CPU Backend)** | $\mathbf{< 80\%}$ | **12% – 16%** | **PASS** | Tiến trình Node.js chạy êm ái trên máy chủ thử nghiệm. |
| **Mức chiếm dụng RAM** | $\mathbf{< 300\text{ MB}}$ | **~87.4 MB** | **PASS** | Không phát hiện rò rỉ bộ nhớ (Memory Leak) trong suốt quá trình chạy. |

---

## 3. Bảng Chi tiết Hiệu năng theo từng API Endpoint (Baseline 50 VUs)

*Tổng số đơn hàng đặt thành công:* **331 đơn hàng** (Tỷ lệ Checkout chuẩn: $5.1\%$).

| Tên Endpoint | Phương thức | Số lượt gọi (Count) | P50 (ms) | P90 (ms) | P95 (ms) | P99 (ms) | Max (ms) | Tỷ lệ lỗi |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `POST /api/login` | `POST` | 50 | 1.9 ms | 3.2 ms | 3.2 ms | 17.8 ms | 18.2 ms | 0.00% |
| `GET /api/products?search` | `GET` | 4,544 | 1.5 ms | 1.9 ms | 2.0 ms | 3.3 ms | 11.2 ms | 0.00% |
| `GET /api/products/:id` | `GET` | 1,651 | 1.4 ms | 1.9 ms | 2.0 ms | 4.5 ms | 9.4 ms | 0.00% |
| `POST /api/cart` | `POST` | 331 | 1.4 ms | 1.9 ms | 2.0 ms | 2.5 ms | 6.8 ms | 0.00% |
| `POST /api/apply-coupon` | `POST` | 331 | 1.9 ms | 2.8 ms | 2.9 ms | 5.0 ms | 8.1 ms | 0.00% |
| `POST /api/checkout` | `POST` | 331 | 5.0 ms | 10.4 ms | **13.6 ms** | **23.4 ms** | **30.5 ms** | 0.00% |
| `GET /api/orders/my-orders` | `GET` | 331 | 1.6 ms | 2.5 ms | 2.7 ms | 4.1 ms | 7.9 ms | 0.00% |

> **Nhận xét chuyên sâu:** Endpoint `POST /api/checkout` có độ trễ $P95 = 13.6\text{ ms}$ và $P99 = 23.4\text{ ms}$ (cao nhất trong toàn bộ 7 API). Điều này hoàn toàn khớp với dự đoán lý thuyết: Checkout là tác vụ **Ghi dữ liệu (Write operation)** xuống bảng `orders` của SQLite, đòi hỏi cơ chế đồng bộ ổ đĩa và khóa tệp, trong khi các API còn lại là tác vụ Đọc/Ghi bộ nhớ tạm (`SELECT` / In-memory cart).

---

## 4. Phân tích So sánh Năng lực Chịu tải: Baseline (50 VUs) vs Spike (500 VUs)

| Chỉ số đo đạc | Baseline Load (50 VUs) | Spike Test (500 VUs) | Tỷ lệ tăng trưởng | Phân tích hành vi hệ thống |
| :--- | :---: | :---: | :---: | :--- |
| **Tổng số HTTP Requests** | 7,570 requests | **59,621 requests** | **$\times 7.9$ lần** | Hệ thống xử lý khối lượng request khổng lồ trong cùng 5 phút. |
| **Thông lượng (Throughput)** | 25.16 req/s | **197.86 req/s** | **$\times 7.9$ lần** | Node.js Event-Driven thể hiện khả năng phục vụ non-blocking xuất sắc. |
| **Độ trễ P95 toàn cục** | 3.95 ms | **4.12 ms** | $+4.3\%$ | Độ trễ hầu như không bị suy giảm đáng kể dù tải tăng gấp 10 lần. |
| **Số đơn hàng tạo thành công** | 331 đơn hàng | **2,510 đơn hàng** | **$\times 7.6$ lần** | 2,510 đơn hàng được ghi thành công vào CSDL `database.sqlite`. |
| **Tỷ lệ lỗi tổng thể** | 0.00% | **0.00%** | Giữ vững 0% | Hệ thống tự phục hồi hoàn toàn sau pha sốc tải đỉnh 500 VUs. |

---

## 5. Kết luận & Khuyến nghị Kiến trúc (Architectural Takeaways)

1. **Kết luận Đánh giá SLO:** Hệ thống EShop **ĐẠT CHUẨN 100% (PASS)** đối với toàn bộ 5 tiêu chí SLO cam kết cho mốc Milestone M5.
2. **Khuyến nghị cho môi trường Production:**
   * Hiện tại, với SQLite trên ổ cứng SSD NVMe local, cơ chế hàng đợi bất đồng bộ của thư viện `sqlite3` trong Node.js đã xử lý tuần tự 2,510 lượt checkout mà không bị timeout.
   * Tuy nhiên, trên môi trường Production thực tế với hàng nghìn người dùng phân tán và độ trễ mạng thực, **SQLite (single-file lock) sẽ trở thành điểm nghẽn nghiêm trọng (Single Point of Contention)**. Cần chuyển đổi sang hệ CSDL phân tán có hỗ trợ Connection Pooling như **PostgreSQL** kết hợp phân tách cơ chế Read Replica và Write Master.
````

**(3) Verdict:** VALID

**(4) Lý do (ISTQB / slide):** Báo cáo SLO 1 trang được lập dựa trên số liệu thực nghiệm đo đạc từ file baseline_results.json (7,570 reqs, P95 3.95ms) và spike_results.json (59,621 reqs, 197.86 req/s). Đối chiếu đầy đủ 5 tiêu chuẩn SLO bắt buộc (P95 < 500ms, Error rate < 1%, Throughput >= 20, CPU < 80%, RAM < 300MB), phân tích chi tiết độ trễ 7 endpoint và đưa ra khuyến nghị kiến trúc SQLite vs PostgreSQL theo đúng chuẩn Milestone M5.

**(5) Bản sinh viên sửa:**

````text
Báo cáo hoàn chỉnh đã được lưu tại k6-eshop/SLO_Report.md.
````

## 4. Tổng kết độ chính xác AI

| Chỉ số | Số lượng | Tỉ lệ |
|---|---|---|
| Tổng artifact AI sinh đã audit | 8 | 100% |
| VALID (đúng, dùng nguyên) | 7 | 88% |
| INVALID (sai; loại bỏ) | 0 | 0% |
| INCOMPLETE (chấp nhận sau khi sửa) | 1 | 12% |

## 5. Kết luận - Khi nào nên / không nên dùng AI?

<!-- SINH VIÊN TỰ VIẾT 80-150 chữ: AI mạnh ở đâu, sai ở đâu, khuyến nghị. Xoá dòng này sau khi viết. -->

## 6. Mandatory Disclosure

> Test case / script / báo cáo này được sinh phiên bản đầu bởi Antigravity Assistant, Antigravity Assistant + Node.js Seeder, Claude 3.7 Sonnet, Claude 3.7 Sonnet + Human Audit; tôi đã rà soát và chỉnh sửa [phần X], bổ sung [edge case Y, Z]; [phần W] do tôi tự viết. AI Audit Report chi tiết đính kèm ở Phụ lục A. Tôi cam đoan không dùng AI để sinh bất kỳ artifact nào thuộc danh mục bị cấm.

<!-- SINH VIÊN điền [phần X], [Y, Z], [phần W] bằng nội dung thật; ký tên: -->

Họ tên sinh viên (in hoa): TRUONG THANH PHAT  
MSSV: 23120319  
Lớp / Khoá: Seminar Nhom 07  
Môn học: CS423 / CSC13003 - Kiểm chứng Phần mềm  
Giảng viên:  
Ngày:  
Chữ ký:
