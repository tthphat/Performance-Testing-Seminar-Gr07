// ============================================================================
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
