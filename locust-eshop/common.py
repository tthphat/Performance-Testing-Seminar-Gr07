"""Shared EShop actions; run one of the four scenario files."""
import csv
import math
import random
from pathlib import Path
from gevent.queue import Queue, Empty
from locust import HttpUser, between, task
from locust.exception import StopUser

ROOT = Path(__file__).resolve().parent
KEYWORDS = ['iphone', 'samsung', 'macbook', 'airpods', 'keychron', 'pro', 'tai nghe']


def valid_price(value):
    """EShop detail can return numeric strings, as handled by its frontend."""
    # Chấp nhận số/chuỗi số dương hữu hạn; loại bool, NaN và vô hạn.
    if isinstance(value, bool):
        return False
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError):
        return False
    return math.isfinite(number) and number > 0


def account_pool(required):
    # Data-driven: đọc CSV, kiểm tra đủ email khác nhau rồi tạo hàng đợi tài khoản.
    path = ROOT / 'users.csv'
    if not path.exists():
        raise ValueError('Run node seed_users.js first: missing users.csv')
    with path.open(encoding='utf-8-sig', newline='') as stream:
        accounts = list(csv.DictReader(stream))
    unique = {row['email']: row for row in accounts if row.get('email') and row.get('password')}
    if len(unique) < required:
        raise ValueError(f'Need {required} distinct test accounts; found {len(unique)}. Run node seed_users.js.')
    pool = Queue()
    for row in unique.values():
        pool.put(row)
    return pool


class EShopUser(HttpUser):
    abstract = True  # Lớp dùng chung, được các kịch bản cụ thể kế thừa.
    wait_time = between(1, 3)  # Thời gian nghỉ giữa các tác vụ, không phải độ trễ API.
    accounts = None

    def on_start(self):
        # Chạy khi mỗi VU bắt đầu; các trạng thái dưới đây thuộc riêng VU đó.
        self.products = []
        self.account = None
        self.auth = None
        # Kịch bản không cần tài khoản (Endurance) bỏ qua đăng nhập.
        if self.accounts is not None:
            try:
                # Lấy ngay một tài khoản khỏi hàng đợi chung trong tiến trình.
                self.account = self.accounts.get_nowait()
            except Empty:
                raise StopUser()  # Hết tài khoản: dừng VU này, không dừng cả bài test.
            self.login()  # Đăng nhập, lấy JWT và lưu header xác thực vào self.auth.

    def on_stop(self):
        # Trả tài khoản khi VU dừng để VU khác trong tiến trình có thể dùng lại.
        if self.account is not None:
            self.accounts.put(self.account)
            self.account = None

    def checked(self, method, path, label, validator, **kwargs):
        # catch_response cho phép đánh dấu lỗi checkpoint dù HTTP trả 200.
        with self.client.request(method, path, name=label, catch_response=True, timeout=10, **kwargs) as response:
            try:
                data = response.json()
            except ValueError:
                response.failure('Invalid JSON')
                return None
            if response.status_code != 200 or not validator(data):
                response.failure(f'Unexpected status/body: {response.status_code}')
                return None
            response.success()
            return data

    def login(self):
        # Đăng nhập bằng tài khoản đã cấp; token phải là chuỗi không rỗng.
        data = self.checked('POST', '/api/login', 'POST /api/login',
            lambda d: isinstance(d, dict) and isinstance(d.get('token'), str) and bool(d['token']),
            json={'email': self.account['email'], 'password': self.account['password']})
        if data is None:
            raise StopUser()
        self.auth = {'Authorization': f"Bearer {data['token']}"}  # JWT dùng cho checkout.

    # Trọng số 70/25/5 là xác suất chọn tác vụ, không đảm bảo tỷ lệ HTTP request.
    @task(70)
    def search(self):
        # Trong tác vụ này: 30% xem danh sách, 70% tìm bằng từ khóa ngẫu nhiên.
        keyword = '' if random.random() < 0.3 else random.choice(KEYWORDS)
        products = self.checked('GET', '/api/products', 'GET /api/products?search',
            lambda d: isinstance(d, list) and all(isinstance(p, dict) and p.get('id') is not None for p in d),
            params={'search': keyword})
        if products:
            self.products = products
        return products

    def product(self):
        # Chọn sản phẩm đã lưu; nếu chưa có thì gọi thêm API catalog.
        if not self.products:
            self.products = self.checked('GET', '/api/products', 'GET /api/products [catalog]',
                lambda d: isinstance(d, list) and len(d) > 0 and all(isinstance(p, dict) and p.get('id') is not None for p in d)) or []
        return random.choice(self.products) if self.products else None

    @task(25)
    def detail(self):
        # Kiểm tra đúng ID và giá hợp lệ, lưu sản phẩm để dùng khi checkout.
        product = self.product()
        if product is None:
            return None
        data = self.checked('GET', f"/api/products/{product['id']}", 'GET /api/products/:id',
            lambda d: isinstance(d, dict) and d.get('id') == product['id'] and valid_price(d.get('price')))
        if data:
            self.selected_product = data
        return data

    @task(5)
    def checkout(self):
        # Gửi JWT và giá đã chuẩn hóa; checkpoint chỉ xác nhận orderId hợp lệ.
        product = getattr(self, 'selected_product', None) or self.product()
        if not product or not valid_price(product.get('price')):
            return None
        return self.checked('POST', '/api/checkout', 'POST /api/checkout',
            lambda d: isinstance(d, dict) and isinstance(d.get('orderId'), int) and d['orderId'] > 0,
            headers=self.auth, json={'total_amount': float(product['price']), 'shipping_address': 'Locust seminar test'})
