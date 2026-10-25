// ============================================================================
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
