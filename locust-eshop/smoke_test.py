"""2 VUs: each runs login -> search -> detail -> checkout once, within 1 minute."""
from locust import LoadTestShape, task
from locust.exception import StopUser
from common import EShopUser, account_pool


class SmokeTestUser(EShopUser):
    abstract = False
    accounts = account_pool(2)
    tasks = []

    @task
    def smoke_flow(self):
        # Login already ran once in on_start; subsequent steps run once here.
        if not self.search():
            raise StopUser()
        if self.detail() is None:
            raise StopUser()
        self.checkout()
        raise StopUser()


# Replace inherited weighted tasks: Smoke must execute only the ordered flow.
SmokeTestUser.tasks = [SmokeTestUser.smoke_flow]


class SmokeTestShape(LoadTestShape):
    def tick(self):
        return (2, 2) if self.get_run_time() < 60 else None
