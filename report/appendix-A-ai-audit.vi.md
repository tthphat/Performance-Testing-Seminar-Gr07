# Phụ lục A - AI Audit Report

CS423 / CSC13003 - Kiểm chứng Phần mềm (AI-augmented · 2026) - Biểu mẫu 5 mục cho mỗi artifact

## 1. Thông tin sinh viên

| Mục | Giá trị |
|---|---|
| Họ tên sinh viên (in hoa) | TRUONG THANH PHAT |
| MSSV | 23120319 |
| Lớp / Khoá | Seminar Nhom 07 |
| Mã bài tập | Seminar-T05 Performance Testing |
| Ngày làm bài | 22/10/2026 |
| Công cụ AI đã dùng | Antigravity Assistant + Node.js Seeder, Claude 3.7 Sonnet, Claude 3.7 Sonnet + Human Audit |
| Có dùng AI | [x] Có [ ] Không |

## 2. Hướng dẫn
Mỗi artifact do AI sinh có một mục bên dưới, gồm: (1) prompt + công cụ, (2) output AI, (3) verdict, (4) lý do (dẫn chiếu slide/ISTQB/RFC), (5) bản sinh viên sửa. Prompt và output được dán nguyên văn.

## 3. Bảng audit - 1 mục / artifact

| # | Bước | Công cụ | Verdict |
|---|---|---|---|
| A01 | Performance Testing / k6 Baseline Script / Milestone M4 | Claude 3.7 Sonnet | INCOMPLETE |
| A02 | Performance Testing / k6 Refined Script / Milestone M4 | Claude 3.7 Sonnet + Human Audit | VALID |
| A03 | Performance Testing / Data-Driven Testing / Milestone M2 | Antigravity Assistant + Node.js Seeder | VALID |

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

## 4. Tổng kết độ chính xác AI

| Chỉ số | Số lượng | Tỉ lệ |
|---|---|---|
| Tổng artifact AI sinh đã audit | 3 | 100% |
| VALID (đúng, dùng nguyên) | 2 | 67% |
| INVALID (sai; loại bỏ) | 0 | 0% |
| INCOMPLETE (chấp nhận sau khi sửa) | 1 | 33% |

## 5. Kết luận - Khi nào nên / không nên dùng AI?

<!-- SINH VIÊN TỰ VIẾT 80-150 chữ: AI mạnh ở đâu, sai ở đâu, khuyến nghị. Xoá dòng này sau khi viết. -->

## 6. Mandatory Disclosure

> Test case / script / báo cáo này được sinh phiên bản đầu bởi Antigravity Assistant + Node.js Seeder, Claude 3.7 Sonnet, Claude 3.7 Sonnet + Human Audit; tôi đã rà soát và chỉnh sửa [phần X], bổ sung [edge case Y, Z]; [phần W] do tôi tự viết. AI Audit Report chi tiết đính kèm ở Phụ lục A. Tôi cam đoan không dùng AI để sinh bất kỳ artifact nào thuộc danh mục bị cấm.

<!-- SINH VIÊN điền [phần X], [Y, Z], [phần W] bằng nội dung thật; ký tên: -->

Họ tên sinh viên (in hoa): TRUONG THANH PHAT  
MSSV: 23120319  
Lớp / Khoá: Seminar Nhom 07  
Môn học: CS423 / CSC13003 - Kiểm chứng Phần mềm  
Giảng viên:  
Ngày:  
Chữ ký:
