"""Shared EShop actions; run one of the four scenario files."""
import csv
import random
from pathlib import Path
from gevent.queue import Queue, Empty
from locust import HttpUser, between, task
from locust.exception import StopUser

ROOT = Path(__file__).resolve().parent
KEYWORDS = ['iphone', 'samsung', 'macbook', 'airpods', 'keychron', 'pro', 'tai nghe']


def account_pool(required):
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
    abstract = True
    wait_time = between(1, 3)
    accounts = None

    def on_start(self):
        self.products = []
        self.account = None
        self.auth = None
        if self.accounts is not None:
            try:
                self.account = self.accounts.get_nowait()
            except Empty:
                raise StopUser()
            self.login()

    def on_stop(self):
        if self.account is not None:
            self.accounts.put(self.account)
            self.account = None

    def checked(self, method, path, label, validator, **kwargs):
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
        data = self.checked('POST', '/api/login', 'POST /api/login',
            lambda d: isinstance(d, dict) and isinstance(d.get('token'), str) and bool(d['token']),
            json={'email': self.account['email'], 'password': self.account['password']})
        if data is None:
            raise StopUser()
        self.auth = {'Authorization': f"Bearer {data['token']}"}

    @task(70)
    def search(self):
        keyword = '' if random.random() < 0.3 else random.choice(KEYWORDS)
        products = self.checked('GET', '/api/products', 'GET /api/products?search',
            lambda d: isinstance(d, list) and all(isinstance(p, dict) and p.get('id') is not None for p in d),
            params={'search': keyword})
        if products:
            self.products = products
        return products

    def product(self):
        if not self.products:
            self.products = self.checked('GET', '/api/products', 'GET /api/products [catalog]',
                lambda d: isinstance(d, list) and len(d) > 0 and all(isinstance(p, dict) and p.get('id') is not None for p in d)) or []
        return random.choice(self.products) if self.products else None

    @task(25)
    def detail(self):
        product = self.product()
        if product is None:
            return None
        data = self.checked('GET', f"/api/products/{product['id']}", 'GET /api/products/:id',
            lambda d: isinstance(d, dict) and d.get('id') == product['id'] and isinstance(d.get('price'), (int, float)) and d['price'] > 0)
        if data:
            self.selected_product = data
        return data

    @task(5)
    def checkout(self):
        product = getattr(self, 'selected_product', None) or self.product()
        if not product or not isinstance(product.get('price'), (int, float)) or product['price'] <= 0:
            return None
        return self.checked('POST', '/api/checkout', 'POST /api/checkout',
            lambda d: isinstance(d, dict) and isinstance(d.get('orderId'), int) and d['orderId'] > 0,
            headers=self.auth, json={'total_amount': product['price'], 'shipping_address': 'Locust seminar test'})
