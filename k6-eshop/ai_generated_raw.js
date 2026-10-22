import http from 'k6/http';
import { check, sleep } from 'k6';

// AI Generated Raw Script (Prompted from ChatGPT for EShop Performance Testing)
export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp up to 50 VUs
    { duration: '4m', target: 50 },  // Hold at 50 VUs
    { duration: '30s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],   // Error rate should be less than 1%
  },
};

const BASE_URL = 'http://localhost:3000';

export default function () {
  // Login to obtain JWT Token (Called every iteration)
  const loginPayload = JSON.stringify({
    email: 'test@domain.com',
    password: 'Password123!',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const loginRes = http.post(`${BASE_URL}/api/login`, loginPayload, params);
  
  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
  });

  let token = '';
  try {
    token = loginRes.json('token');
  } catch (e) {
    console.error('Failed to parse token');
  }

  const authParams = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };

  // Mixed-workload distribution: 70% Search, 25% Detail, 5% Checkout
  const rand = Math.random();

  if (rand < 0.70) {
    // 70% Search / Browse products
    const searchRes = http.get(`${BASE_URL}/api/products?search=phone`, authParams);
    check(searchRes, {
      'search status is 200': (r) => r.status === 200,
    });
  } else if (rand < 0.95) {
    // 25% Product detail (Hardcoded product ID 1)
    const detailRes = http.get(`${BASE_URL}/api/products/1`, authParams);
    check(detailRes, {
      'detail status is 200': (r) => r.status === 200,
    });
  } else {
    // 5% Checkout flow
    // Apply coupon
    const couponPayload = JSON.stringify({
      code: 'SAVE10',
      total_amount: 500000,
      user_id: 1,
    });
    const couponRes = http.post(`${BASE_URL}/api/apply-coupon`, couponPayload, authParams);
    check(couponRes, {
      'coupon status is 200': (r) => r.status === 200,
    });

    // Checkout
    const checkoutPayload = JSON.stringify({
      total_amount: 450000,
      shipping_address: '123 Le Loi, TP.HCM',
    });
    const checkoutRes = http.post(`${BASE_URL}/api/checkout`, checkoutPayload, authParams);
    check(checkoutRes, {
      'checkout status is 200': (r) => r.status === 200,
    });

    // View My Orders
    const ordersRes = http.get(`${BASE_URL}/api/orders/my-orders`, authParams);
    check(ordersRes, {
      'orders status is 200': (r) => r.status === 200,
    });
  }

  // Think time fixed at 1s
  sleep(1);
}
