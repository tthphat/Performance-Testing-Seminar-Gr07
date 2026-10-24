# Hướng dẫn thực hành kiểm thử hiệu năng EShop bằng Locust

**Seminar T05 – Performance Testing, nhóm 07**
**Người phụ trách Locust: Lục Hoàng Tuấn**

## 1. Mục đích thực hành

Trong phần này, nhóm dùng Locust để gửi nhiều yêu cầu đến Backend API của EShop và quan sát thời gian phản hồi, số yêu cầu xử lý trong một giây và tỷ lệ lỗi. Các thao tác được chọn gồm đăng nhập, tìm kiếm, xem chi tiết và checkout.

Locust mô phỏng người dùng bằng mã Python. Bài thực hành gửi HTTP request trực tiếp đến backend, nên kết quả chưa bao gồm thời gian trình duyệt tải giao diện, hình ảnh hoặc chạy JavaScript.

Nhóm thực hiện bốn kịch bản trong proposal: Smoke, Baseline, Spike và Endurance. Smoke được chạy trước để kiểm tra script và dữ liệu, sau đó mới chuyển sang tải cao hơn.

## 2. Các file trong thư mục

```text
locust-eshop/
├── smoke_test.py         # Luồng nghiệp vụ chạy một lần cho mỗi VU
├── baseline_load.py      # 50 VUs, 5 phút, workload 70/25/5
├── spike_test.py         # Tăng từ 50 lên 500 VUs
├── endurance_test.py     # 50 VUs, 30 phút, workload 90/10
├── common.py             # Request, assertions và đọc tài khoản
├── seed_users.js         # Tạo tài khoản thử và xuất CSV
├── users.csv             # Sinh sau khi seed, không đưa lên Git
├── users.example.csv     # Mẫu cấu trúc tài khoản
├── requirements.txt      # Locust 2.47.0
├── locust-guide.md
├── .gitignore
└── results/              # Kết quả CSV và HTML
```

Mỗi kịch bản có file riêng để dễ chọn bài thử. Các hàm dùng chung nằm trong `common.py` để khi sửa API, nhóm không phải sửa lại cả bốn file. Không chạy `common.py` độc lập.

`users.csv`, `.venv`, bộ nhớ đệm Python và các file kết quả được bỏ qua trong Git. Khi lấy code về máy khác, cần cài môi trường và tạo lại CSV.

## 3. Chuẩn bị môi trường

### 3.1. Kiểm tra công cụ

Máy thực hành cần Python 3.12, Node.js và npm. Mở PowerShell và kiểm tra:

```powershell
py -3.12 --version
node --version
npm --version
```

Nếu lệnh không được nhận diện, kiểm tra phần cài đặt hoặc PATH trước khi làm tiếp. Bài này kiểm thử API nên không cần mở frontend web/admin.

### 3.2. Cài thư viện backend

Trên máy hiện tại, mở PowerShell và chạy:

```powershell
Set-Location -LiteralPath '..\eshop-sut\backend'
npm install
```

Nếu dùng máy khác, thay phần đường dẫn repository cho đúng máy đó. Bước này cài các thư viện EShop, gồm `sqlite3` mà script tạo tài khoản cần dùng. Chưa khởi động backend ở bước này vì nhóm chuẩn bị dữ liệu trước.

### 3.3. Cài Locust

Từ thư mục backend ở bước trên, chuyển sang Locust:

```powershell
Set-Location ..\..\locust-eshop
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m locust --version
```

Kết quả cần hiển thị Locust 2.47.0. Hướng dẫn gọi trực tiếp Python trong `.venv` nên không cần kích hoạt môi trường bằng `Activate.ps1`. Cách này giúp tránh dùng nhầm Python chưa có Locust.

## 4. Tạo tài khoản và mở backend

### 4.1. Tạo dữ liệu trước bài đo

Tại `locust-eshop`, chạy:

```powershell
node seed_users.js
(Import-Csv .\users.csv | Measure-Object).Count
```

Script thêm 500 tài khoản từ `user1@eshop.com` đến `user500@eshop.com` vào `eshop-sut/backend/database.sqlite`, rồi xuất `users.csv`. Tài khoản mới có mật khẩu thử nghiệm `Test1234!`. Nếu email đã tồn tại thì script bỏ qua, không đặt lại mật khẩu.

CSV có các cột `email,password,id`; Locust dùng email và password để đăng nhập. Trên database thực hành hiện tại, lệnh đếm trả về 500. Smoke cần ít nhất 2 tài khoản khác email, Baseline cần 50 và Spike cần 500. Endurance chỉ đọc sản phẩm nên không cần tài khoản.

Nếu backend đang chạy, dừng bằng `Ctrl+C` ở terminal backend trước khi seed. Tạo tài khoản trước bài đo để thời gian chuẩn bị không bị tính vào kết quả performance. Các bài có checkout sẽ tạo đơn thử trong database thực hành.

### 4.2. Chạy backend ở terminal thứ hai

Mở terminal khác và chạy:

```powershell
Set-Location -LiteralPath 'D:\HCM Ú\Năm 4\Testing\SUT_Performance_Testing\Performance-Testing-Seminar-Gr07\eshop-sut\backend'
node server.js
```

Giữ terminal này hoạt động trong suốt bài thử. Quay lại terminal Locust và kiểm tra:

```powershell
(Invoke-WebRequest -Uri 'http://localhost:3000/api/products' -TimeoutSec 10).StatusCode
```

Kết quả cần là `200`. Mở thêm đường dẫn trên bằng trình duyệt để xem có dữ liệu sản phẩm không. Nếu API chưa hoạt động hoặc chưa có sản phẩm thì xử lý backend trước khi tăng tải.

## 5. Giải thích cách script hoạt động

### 5.1. Tài khoản và thời gian nghỉ

Ở Smoke, Baseline và Spike, mỗi VU lấy một tài khoản từ hàng đợi, đăng nhập khi bắt đầu và giữ tài khoản đến lúc dừng. Sau khi VU dừng, tài khoản được trả lại. Cách này giúp các VU đang hoạt động trong cùng bài không dùng chung tài khoản.

Bài thực hành chạy một tiến trình Locust. Hàng đợi hiện tại chưa chia tài khoản giữa nhiều worker trên nhiều máy. Khi lấy số liệu, chạy từng kịch bản và từng công cụ lần lượt để tránh các bài cùng tạo tải lên backend.

Giữa các tác vụ, VU nghỉ ngẫu nhiên 1–3 giây để mô phỏng thời gian thao tác. Riêng Smoke gom các bước thành một luồng chạy một lần rồi dừng, không chèn khoảng nghỉ giữa từng bước trong luồng đó.
Trong riêng tác vụ search/list, 30% lần chọn dùng chuỗi rỗng để xem danh sách, 70% còn lại chọn một từ khóa ngẫu nhiên, giống cách k6 thực hiện.

Ở Baseline và Spike, trọng số chọn tác vụ là 70 search/list, 25 detail và 5 checkout. Đây là xác suất chọn tác vụ, không phải cam kết đúng tỷ lệ HTTP request trong từng lần chạy. Login đầu phiên và request catalog phụ cũng được thống kê. Không nhầm tỷ lệ 70% search của toàn bài với tỷ lệ chọn từ khóa bên trong search.

Ở Endurance, danh sách tác vụ chỉ còn 90% search/list và 10% detail; không đăng nhập và không checkout.

### 5.2. JWT và assertions

| Thao tác | API | Điều kiện kiểm tra |
|---|---|---|
| Login | `POST /api/login` | HTTP 200, JSON hợp lệ, token là chuỗi không rỗng |
| Search/list | `GET /api/products?search=...` | HTTP 200, JSON là danh sách, mỗi sản phẩm có id |
| Detail | `GET /api/products/:id` | HTTP 200, đúng id, giá là số dương |
| Checkout | `POST /api/checkout` | HTTP 200, orderId là số nguyên dương |

Token trả về từ login được gửi trong header `Authorization: Bearer <token>` khi checkout. Đây là JWT correlation: lấy dữ liệu từ phản hồi trước để dùng cho yêu cầu tiếp theo.

Theo backend hiện tại, checkout nhận `total_amount` và `shipping_address`. Script dùng giá sản phẩm được chọn làm tổng tiền. Không thêm bước cart, coupon hoặc lịch sử đơn ngoài luồng đã chốt. Khi chưa có sản phẩm để chọn, script có thể gọi thêm API catalog.

Hàm `checked()` dùng `catch_response=True` để đánh dấu lỗi nếu HTTP hoặc dữ liệu không đạt điều kiện. Vì vậy HTTP 200 vẫn có thể bị tính là thất bại khi JSON sai dạng hoặc thiếu token/orderId. Timeout cho mỗi request là 10 giây.

## 6. Chạy bốn kịch bản

Các lệnh dưới đây chạy tại `locust-eshop`, trong khi backend vẫn hoạt động ở terminal riêng. Chạy từng bài một, đợi bài trước kết thúc rồi mới chạy bài tiếp theo.

Script có `LoadTestShape` điều khiển tải và thời lượng nên không cần thêm `--users`, `--spawn-rate`, `--run-time`, `TEST_PROFILE` hoặc `ENABLE_CHECKOUT`.

### 6.1. Smoke Test

```powershell
.\.venv\Scripts\python.exe -m locust -f smoke_test.py --headless --host http://localhost:3000 --csv results/smoke --html results/smoke.html
```

Bài chạy có 2 VUs trong cửa sổ 1 phút. Mỗi VU thực hiện login → search → detail → checkout một lần. Nếu login, search hoặc detail thất bại thì VU dừng, không tiếp tục với dữ liệu sai.

Khi dữ liệu phù hợp và không cần catalog phụ, kết quả mong đợi là 8 request: 2 login, 2 search, 2 detail và 2 checkout. VU xong luồng sẽ dừng ngay, nên số VU có thể về 0 trước khi hết phút. Đây là Smoke chạy một lần, không phải bài tạo tải liên tục.

Xem số lỗi và file failures trước khi chuyển Baseline. Exit code 0 chỉ cho biết chương trình kết thúc bình thường; vẫn phải đọc thống kê vì script chưa tự chấm đạt/chưa đạt theo SLO.

### 6.2. Baseline Load Test

```powershell
.\.venv\Scripts\python.exe -m locust -f baseline_load.py --headless --host http://localhost:3000 --csv results/baseline --csv-full-history --html results/baseline.html
```

Mục tiêu là 50 VUs ngay đầu bài, duy trì đến hết 5 phút; workload 70% search/list, 25% detail và 5% checkout. Tốc độ khởi tạo là 50 VUs/giây, nên vẫn có khoảng ngắn để tạo người dùng và đăng nhập.

Kết quả được dùng làm mốc so sánh cho Spike. Nhóm lấy P50, P95, P99, RPS và tỷ lệ lỗi. Ghi nhận thời lượng thực tế vì khi kết thúc có thể còn request đang xử lý.

### 6.3. Spike Test

```powershell
.\.venv\Scripts\python.exe -m locust -f spike_test.py --headless --host http://localhost:3000 --csv results/spike --csv-full-history --html results/spike.html
```

| Thời gian từ lúc bắt đầu | VUs mục tiêu | Nội dung quan sát |
|---|---|---|
| 0–60 giây | 50 | Tình trạng trước tăng tải |
| 60–90 giây | Tăng 50 lên 500 | Phản ứng khi truy cập tăng nhanh |
| 90–210 giây | 500 | Độ trễ và lỗi ở tải đỉnh |
| 210–240 giây | Giảm 500 về 50 | Hạ tải |
| 240–300 giây | 50 | Phục hồi sau khi hạ tải |

Trong 90 giây recovery của proposal, nhóm chia thành 30 giây giảm tải và 60 giây quan sát tại 50 VUs. Workload giống Baseline, mỗi VU có tài khoản thử riêng và không dùng coupon.

Shape cập nhật mục tiêu theo thời gian, còn số VU thực tế có thể trễ nếu máy không tạo tải kịp. Khi phân tích cần xem cả history. Không dùng P95 toàn bài để kết luận riêng giai đoạn 500 VUs; xem các khoảng trước Spike, tải đỉnh và phục hồi.

### 6.4. Endurance Test

Chỉ chạy sau khi Baseline và Spike đã hoàn thành, script hoạt động đúng và máy còn đủ thời gian cho bài 30 phút.

```powershell
.\.venv\Scripts\python.exe -m locust -f endurance_test.py --headless --host http://localhost:3000 --csv results/endurance --csv-full-history --html results/endurance.html
```

Mục tiêu là 50 VUs trong 30 phút, với 90% search/list và 10% detail. So sánh đầu, cuối và diễn biến bài chạy để xem thời gian phản hồi hoặc lỗi có tăng dần không. Kết quả chỉ phản ánh khoảng 30 phút thực hành.

Nếu nhận xét về bộ nhớ thì phải đo RAM theo thời gian. Không kết luận có hay không có memory leak chỉ từ một số đo cuối bài.

## 7. Đọc và lưu kết quả

### 7.1. Ý nghĩa tùy chọn và file xuất

| Tùy chọn | Tác dụng |
|---|---|
| `-f` | Chọn file kịch bản |
| `--headless` | Chạy bằng dòng lệnh |
| `--host` | Địa chỉ backend |
| `--csv` | Tiền tố của các file CSV |
| `--csv-full-history` | Ghi history chi tiết theo nhóm request ngoài dòng tổng hợp |
| `--html` | Xuất báo cáo HTML |

Ví dụ, sau Baseline, xem các file trong `results`:

| File | Dùng để làm gì? |
|---|---|
| `baseline_stats.csv` | Tổng request, số lỗi, thời gian phản hồi, phân vị và RPS |
| `baseline_stats_history.csv` | Xem diễn biến thống kê theo thời gian |
| `baseline_failures.csv` | Xem loại lỗi và số lần gặp |
| `baseline_exceptions.csv` | Xem ngoại lệ trong code Python nếu có |
| `baseline.html` | Xem báo cáo và chụp minh chứng |

Mở báo cáo bằng trình duyệt hoặc chạy:

```powershell
Start-Process .\results\baseline.html
```

## 8. Lỗi thường gặp và cách kiểm tra

| Hiện tượng | Cách xử lý |
|---|---|
| `No module named locust` | Dùng Python trong `.venv`, cài lại bằng `-m pip install -r requirements.txt` |
| Thiếu `users.csv` | Chạy `node seed_users.js` tại `locust-eshop` |
| `Need 500 distinct test accounts` | CSV chưa đủ email khác nhau; chạy lại seed và đếm dữ liệu |
| Seed không tìm thấy `sqlite3` | Chạy `npm install` tại `eshop-sut/backend` |
| Connection refused | Kiểm tra backend còn chạy, đúng cổng 3000 và API products truy cập được |
| Login 401/403 | Kiểm tra CSV, mật khẩu và trạng thái khóa; seed không đặt lại tài khoản cũ |
| HTTP 200 vẫn báo lỗi | Xem assertion: JSON sai dạng, thiếu token/orderId, sai id hoặc giá không hợp lệ |
| Smoke ít hơn 8 request | Kiểm tra bước trước có thất bại hoặc search trả danh sách rỗng khiến luồng dừng không |
| Có dòng `[catalog]` | Script lấy thêm dữ liệu để chọn sản phẩm; request này được tính vào thống kê |
| History chưa có dữ liệu | Kiểm tra đã phát sinh request và bài chạy đủ lâu để ghi history chưa |
| Spike chưa đạt 500 VUs | Kiểm tra lỗi login, tài khoản và tài nguyên máy tạo tải; đối chiếu mục tiêu với history |
| Lệnh cũ tìm `locustfile.py` | Chọn đúng một trong bốn file kịch bản hiện tại |
