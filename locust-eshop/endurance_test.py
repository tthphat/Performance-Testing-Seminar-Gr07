"""50 VUs, 30 minutes; 90% search, 10% detail; run after Baseline/Spike."""
from locust import LoadTestShape
from common import EShopUser


class EnduranceTestUser(EShopUser):
    abstract = False
    tasks = {EShopUser.search: 9, EShopUser.detail: 1}


# Replace inherited tasks, excluding checkout entirely.
EnduranceTestUser.tasks = [EShopUser.search] * 9 + [EShopUser.detail]


class EnduranceTestShape(LoadTestShape):
    def tick(self):
        return (50, 50) if self.get_run_time() < 1800 else None
