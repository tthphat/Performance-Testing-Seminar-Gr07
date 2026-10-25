# BÁO CÁO SLO 1 TRANG (1-PAGE SLO REPORT)
## ĐỀ TÀI T05: PERFORMANCE TESTING – ESHOP SUT (NHÓM 07)

* **Môn học:** Software Testing (CS423 / CSC15003) – Khoa CNTT, ĐHKHTN (FIT@HCMUS)
* **Sinh viên phụ trách:** Trương Thành Phát (MSSV: 23120319) 
* **Công cụ thực nghiệm:** Grafana k6 v2.2.0 (Native Windows CLI)
* **Hệ thống SUT:** EShop (Backend Node.js + SQLite tại `http://localhost:3000`)
* **Ngày thực hiện & cập nhật:** 25/10/2026

---

## 1. Bảng Ma trận Thực thi Kiểm thử (Test Execution Matrix)

| Kịch bản kiểm thử | Cấu hình Virtual Users (VUs) | Thời gian chạy | Tổng HTTP Requests | Thông lượng (Throughput) | Tỷ lệ lỗi (Error Rate) | Tỷ lệ Checks đạt | Trạng thái |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Smoke Test** | 1 VU | 1 phút (1 iter) | 8 reqs | 1.97 req/s | **0.00%** | **100% (13/13)** | **PASS** |
| **2. Baseline Load** | 50 VUs | 5 phút | 7,457 reqs | 24.75 req/s | **0.00%** | **100% (14,619/14,619)** | **PASS** |
| **3. Spike Test** | 50 $\rightarrow$ 500 VUs | 5 phút | 59,954 reqs | 199.38 req/s | **0.00%** | **100% (52,141/52,141)** | **PASS** |
| **4. Endurance Test** | 50 VUs | 30 phút | 43,454 reqs | 24.13 req/s | **0.00%** | **100% (86,856/86,856)** | **PASS** |

---

## 2. Bảng Đối chiếu Tiêu chuẩn SLO Cam kết (Đối chiếu bài Baseline 50 VUs)

| Tiêu chuẩn SLO | Ngưỡng cam kết (Target SLO) | Kết quả đo thực tế (Actual) | Đánh giá | Ghi chú kỹ thuật |
| :--- | :---: | :---: | :---: | :--- |
| **Độ trễ phản hồi P95 toàn cục** | $\mathbf{< 500\text{ ms}}$ | **2.64 ms** | **PASS** | Vượt xa cam kết (P95 thực tế nhanh hơn 189 lần so với mức trần 500ms). |
| **Tỷ lệ lỗi HTTP (`http_req_failed`)** | $\mathbf{< 1.0\%}$ | **0.00%** (0 / 7,457 reqs) | **PASS** | 100% request đều trả về HTTP 200 thành công. |
| **Thông lượng (Throughput)** | $\mathbf{\ge 20\text{ req/s}}$ | **24.75 req/s** | **PASS** | Đạt 7,457 requests trong 5 phút, vượt mức sàn kỳ vọng 20 req/s. |
| **Tải vi xử lý (CPU Backend)** | $\mathbf{< 80\%}$ | **Trung bình 0.27%** (Đỉnh: 0.84%) | **PASS** | Đo đạc thực tế qua 153 mẫu log CSV; Node.js non-blocking I/O tối ưu. |
| **Mức chiếm dụng RAM máy chủ** | $\mathbf{< 300\text{ MB}}$ | **60.3 MB $\rightarrow$ Đỉnh 89.45 MB** | **PASS** | V8 Engine giải phóng bộ nhớ về 86.98 MB sau bài test; không rò rỉ RAM. |

---

## 3. Bảng Chi tiết Hiệu năng theo từng API Endpoint (Baseline 50 VUs)

*Tổng số đơn hàng đặt thành công:* **293 đơn hàng** (Tỷ lệ Checkout thực tế: $5.0\%$ đúng theo mô hình Workload Mix).

| Tên Endpoint | Phương thức | Số lượt gọi (Count) | P50 (ms) | P90 (ms) | P95 (ms) | P99 (ms) | Max (ms) | Tỷ lệ lỗi |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `POST /api/login` | `POST` | 50 | 1.92 ms | 2.82 ms | 2.89 ms | 3.23 ms | 3.23 ms | 0.00% |
| `GET /api/products?search` | `GET` | 4,519 | 1.34 ms | 1.59 ms | 1.70 ms | 1.94 ms | 13.91 ms | 0.00% |
| `GET /api/products/:id` | `GET` | 1,695 | 1.33 ms | 1.58 ms | 1.66 ms | 1.91 ms | 12.05 ms | 0.00% |
| `POST /api/cart` | `POST` | 293 | 1.35 ms | 1.61 ms | 1.79 ms | 2.05 ms | 3.51 ms | 0.00% |
| `POST /api/apply-coupon` | `POST` | 293 | 1.83 ms | 2.29 ms | 2.52 ms | 3.26 ms | 4.88 ms | 0.00% |
| `POST /api/checkout` | `POST` | 293 | 11.23 ms | 12.98 ms | **13.29 ms** | **15.65 ms** | **21.01 ms** | 0.00% |
| `GET /api/orders/my-orders` | `GET` | 293 | 1.50 ms | 1.83 ms | 1.98 ms | 2.29 ms | 3.22 ms | 0.00% |

> **Nhận xét chuyên sâu:** Endpoint `POST /api/checkout` có độ trễ $P95 = 13.29\text{ ms}$ và $P99 = 15.65\text{ ms}$ (cao gấp $\approx 7\text{ – }8$ lần so với các API còn lại). Điều này hoàn toàn khớp với lý thuyết kiến trúc: Checkout là thao tác **Ghi đĩa (Disk I/O Write)** vào bảng `orders` của SQLite, phải kích hoạt cơ chế khóa tệp và ghi nhật ký WAL, trong khi các API còn lại là tác vụ Đọc/Ghi bộ nhớ tạm (`SELECT` / In-memory cart) xử lý tức thì dưới $2\text{ ms}$.

---

## 4. Phân tích So sánh Năng lực Chịu tải: Baseline (50 VUs) vs Spike (500 VUs)

| Chỉ số đo đạc | Baseline Load (50 VUs) | Spike Test (500 VUs) | Tỷ lệ tăng trưởng | Phân tích hành vi hệ thống |
| :--- | :---: | :---: | :---: | :--- |
| **Tổng số HTTP Requests** | 7,457 requests | **59,954 requests** | **$\times 8.0$ lần** | Hệ thống xử lý khối lượng request khổng lồ trong cùng 5 phút. |
| **Thông lượng (Throughput)** | 24.75 req/s | **199.38 req/s** | **$\times 8.1$ lần** | Node.js Event-Driven thể hiện khả năng phục vụ non-blocking xuất sắc. |
| **Độ trễ P95 toàn cục** | 2.64 ms | **4.31 ms** | $+1.67\text{ ms}$ | Hệ thống giữ vững độ trễ dưới 5ms ngay cả khi tải tăng gấp 10 lần. |
| **Độ trễ P95 API Checkout** | 13.29 ms | **12.29 ms** (P99: 20.90 ms) | Ổn định | Hàng đợi ghi SQLite tuần tự xử lý 2,604 đơn hàng an toàn. |
| **Số đơn hàng tạo thành công** | 293 đơn hàng | **2,604 đơn hàng** | **$\times 8.9$ lần** | 2,604 đơn hàng được ghi thành công 100% vào `database.sqlite`. |
| **Tỷ lệ lỗi tổng thể** | 0.00% | **0.00%** | Giữ vững 0% | Hệ thống tự phục hồi hoàn toàn sau pha sốc tải đỉnh 500 VUs. |
| **Tải CPU máy chủ (Peak)** | 0.84% | **4.15%** | Tăng nhẹ | CPU vẫn dư thừa hơn 95% năng lực xử lý. |
| **RAM máy chủ (Peak)** | 89.45 MB | **92.59 MB** | $+3.14\text{ MB}$ | Bộ nhớ duy trì ổn định, không bị phình to dưới áp lực tải lớn. |

---

## 5. Phân tích Độ bền Dài hạn & Kiểm định Rò rỉ Bộ nhớ (Endurance Test - 30 Phút)

* **Quy mô thực thi:** 50 VUs chạy liên tục trong 30 phút (1,800 giây), xử lý **43,454 requests** (Thông lượng: **24.13 req/s**).
* **Độ ổn định hiệu năng (Performance Stability):**
  * Tỷ lệ lỗi HTTP giữ vững **0.00%** (0 request thất bại / 43,454).
  * 100% checkpoints thành công (**86,856 / 86,856 passed**).
  * Độ trễ $P95$ toàn thời gian là **$1.70\text{ ms}$** (P50: $1.34\text{ ms}$, P99: $2.02\text{ ms}$, Max: $4.44\text{ ms}$), hoàn toàn không xuất hiện hiện tượng trễ đuôi (tail latency creep).
* **Kiểm định Rò rỉ Bộ nhớ (Zero Memory Leak):**
  * Thu thập **920 mẫu log** độc lập từ `server_hardware_metrics.csv`:
  * CPU trung bình duy trì ở mức **$0.24\%$** (đỉnh cao nhất chỉ **$0.90\%$**).
  * RAM khởi điểm: **$90.45\text{ MB}$** $\rightarrow$ Đỉnh ngâm tải: **$97.61\text{ MB}$** (biên độ dao động chỉ $+7.16\text{ MB}$).
  * Đồ thị RAM thể hiện đường sóng răng cưa (*Sawtooth wave*) mẫu mực: V8 Engine kích hoạt Garbage Collection đều đặn và giải phóng bộ nhớ về **$96.16\text{ MB}$** ngay sau khi ngắt tải $\rightarrow$ Khẳng định tuyệt đối **Zero Memory Leak**.

---

## 6. Kết luận & Khuyến nghị Kiến trúc (Architectural Takeaways)

1. **Kết luận Đánh giá SLO:** Hệ thống EShop **ĐẠT CHUẨN 100% (PASS)** đối với toàn bộ 5/5 tiêu chí SLO cam kết cho mốc Milestone M5.
2. **Khuyến nghị cho môi trường Production:**
   * Hiện tại, với SQLite trên ổ cứng SSD NVMe local, cơ chế hàng đợi bất đồng bộ của thư viện `sqlite3` trong Node.js đã xử lý tuần tự 2,604 lượt checkout trong bài Spike mà không bị crash.
   * Tuy nhiên, trên môi trường Production thực tế với hàng nghìn người dùng phân tán và độ trễ mạng thực, **SQLite (cơ chế khóa ghi đơn luồng Single-writer Lock) sẽ trở thành điểm nghẽn nghiêm trọng (Single Point of Contention)**. Cần chuyển đổi sang hệ CSDL phân tán có hỗ trợ Connection Pooling như **PostgreSQL** kết hợp phân tách cơ chế Read Replica và Write Master.
