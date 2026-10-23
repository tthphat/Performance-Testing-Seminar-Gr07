"""50 VUs, 5 minutes; 70% search, 25% detail, 5% checkout."""
from locust import LoadTestShape
from common import EShopUser, account_pool


class BaselineLoadUser(EShopUser):
    abstract = False
    accounts = account_pool(50)


class BaselineLoadShape(LoadTestShape):
    def tick(self):
        return (50, 50) if self.get_run_time() < 300 else None
