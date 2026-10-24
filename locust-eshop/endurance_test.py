"""50 VUs, 30 minutes; 90% search, 10% detail; run after Baseline/Spike."""
from locust import LoadTestShape
from common import EShopUser


class EnduranceTestUser(EShopUser):
    abstract = False
    tasks = {EShopUser.search: 9, EShopUser.detail: 1}


# Chỉ đọc dữ liệu với trọng số 90/10, loại checkout kế thừa.
EnduranceTestUser.tasks = [EShopUser.search] * 9 + [EShopUser.detail]


class EnduranceTestShape(LoadTestShape):
    def tick(self):
        # Duy trì 50 VU trong 30 phút.
        return (50, 50) if self.get_run_time() < 1800 else None
