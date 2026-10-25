"""Same 70/25/5 workload as Baseline; separate accounts, no coupons."""
from locust import LoadTestShape
from common import EShopUser, account_pool


class SpikeTestUser(EShopUser):
    abstract = False
    accounts = account_pool(500)


class SpikeTestShape(LoadTestShape):
    def tick(self):
        # Giữ tải → tăng tải → tải đỉnh → giảm tải → quan sát phục hồi.
        t = self.get_run_time()
        if t < 60:
            return 50, 50
        if t < 90:
            return min(500, round(50 + (t - 60) * 15)), 15
        if t < 210:
            return 500, 15
        if t < 240:
            return max(50, round(500 - (t - 210) * 15)), 15
        if t < 300:
            return 50, 50
        return None
