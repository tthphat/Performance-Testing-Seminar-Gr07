# Hướng dẫn Kiểm thử Hiệu năng với Gatling (Gatling Performance Testing Guide)

> **Môn học:** Kiểm chứng Phần mềm (Software Testing - CS423 / CSC15003) - FIT@HCMUS  
> **Chủ đề Seminar:** T05 - Performance Testing (Nhóm 07)  
> **Hệ thống kiểm thử (SUT):** EShop (Node.js Express + SQLite tại `http://localhost:3000`)  
> **Bộ kịch bản:** Thư mục `gatling-eshop/`  

---

## 1. Giới thiệu về Gatling & Nguyên lý Hoạt động

### 1.1. Gatling là gì?
**Gatling** là một công cụ kiểm định hiệu năng (Load/Performance Testing) mã nguồn mở hiện đại, được xây dựng trên nền tảng máy ảo Java (JVM). Gatling được thiết kế chuyên biệt cho việc kiểm thử ứng dụng web, REST API và microservices với khả năng chịu tải cực lớn trên cùng một cấu hình phần cứng.

Gatling hỗ trợ viết kịch bản dạng **Code-as-Test** bằng:
- **Java SDK** *(chính thức từ Gatling 3.7+ - được nhóm lựa chọn vì tính trực quan, quen thuộc với sinh viên CNTT)*
- **Scala DSL** *(truyền thống)*
- **Kotlin SDK**
- **JavaScript / TypeScript** *(Gatling CLI mới)*

---

### 1.2. Nguyên lý hoạt động: Asynchronous Non-blocking I/O
Khác biệt lớn nhất giữa Gatling và các công cụ kiểm thử truyền thống (như Apache JMeter) nằm ở **kiến trúc động cơ sinh tải**:

```
+-------------------------------------------------------------------------+
|                  SO SÁNH MÔ HÌNH SINH TẢI (ENGINE)                      |
+-------------------------------------------------------------------------+
|                                                                         |
|  [ Apache JMeter ] : Thread-per-User Model (1 OS Thread = 1 VU)         |
|  VU 1 ----> [ Thread 1 ] === (Blocked chờ HTTP response)                |
|  VU 2 ----> [ Thread 2 ] === (Blocked chờ HTTP response)                |
|  VU 500 --> [ Thread 500] => Tiêu tốn hàng GB RAM, Context Switch cao  |
|                                                                         |
|  [ Gatling ]       : Asynchronous Event-Driven (Netty + Akka Actor)     |
|  VU 1 -----\                                                            |
|  VU 2 -------> [ Netty Event Loop / Vài Thread OS ] (Non-blocking)     |
|  VU 5000 --/   (Một Thread xử lý hàng ngàn kết nối I/O cùng lúc)       |
|                                                                         |
|  [ Grafana k6 ]   : Go Goroutines + JavaScript Runtime (goja)           |
+-------------------------------------------------------------------------+
```

- **Mô hình Netty + Akka:** Thay vì cấp phát một hệ điều hành Thread riêng biệt cho mỗi người dùng ảo (Virtual User), Gatling mô hình hóa mỗi VU như một actor siêu nhẹ (chỉ tốn vài byte bộ nhớ). 
- Khi gửi một HTTP request, thread của Gatling không hề dừng lại chờ phản hồi mà chuyển ngay sang xử lý tác vụ khác. Khi server phản hồi, Netty kích hoạt callback xử lý dữ liệu.
- **Hệ quả thực tế:** 1 máy laptop thông thường có thể dễ dàng chạy kịch bản Gatling mô phỏng **10.000 đến 50.000 VU đồng thời** mà không bị lỗi `java.lang.OutOfMemoryError` hay nghẽn CPU do Context Switching.

---

## 2. Chuẩn bị Môi trường & Cách Cài đặt (Demo Cài đặt)

### 2.1. Yêu cầu hệ thống
- **Java Runtime Environment (JRE) hoặc JDK:** Phiên bản 17 hoặc 21+ (Máy đã được cấu hình sẵn Java).
- **Maven:** Khuyến nghị cài đặt Maven (hoặc sử dụng wrapper `mvnw` / Gatling Standalone Bundle).

### 2.2. Hai phương pháp thực thi Gatling

#### Phương pháp A: Chạy qua Maven (Khuyến nghị cho Source Code & CI/CD)
Dự án trong thư mục `gatling-eshop/` đã tích hợp sẵn tệp `pom.xml` chuẩn với plugin `gatling-maven-plugin`:
```powershell
# Chuyển vào thư mục gatling-eshop
cd gatling-eshop

# Thực thi kịch bản Smoke Test
mvn gatling:test -Dgatling.simulationClass=eshop.SmokeSimulation

# Thực thi kịch bản Baseline Load
mvn gatling:test -Dgatling.simulationClass=eshop.BaselineLoadSimulation

# Thực thi kịch bản Spike Test
mvn gatling:test -Dgatling.simulationClass=eshop.SpikeSimulation
```

#### Phương pháp B: Chạy qua Gatling Standalone Bundle (Không cần cài Maven)
1. Tải bản phân phối ZIP chính thức từ [Gatling Download Center](https://gatling.io/open-source/).
2. Giải nén vào thư mục tuỳ ý (ví dụ: `C:\gatling`).
3. Copy các tệp mô phỏng trong `gatling-eshop/src/test/java/eshop/*.java` vào thư mục `user-files/simulations/`.
4. Copy `users.csv` vào thư mục `user-files/resources/`.
5. Mở terminal tại thư mục Gatling và chạy:
   ```cmd
   bin\gatling.bat
   ```
   Gatling sẽ hiển thị danh sách các Simulation có sẵn trong menu console để bạn chọn bằng phím số.

---

## 3. Ba Cơ chế Bắt buộc theo Tiêu chuẩn Đề bài

Theo quy định chuẩn của môn học (*GeneralRequest.md*), một công cụ kiểm thử hiệu năng tiêu chuẩn phải thể hiện đầy đủ 3 cơ chế:

### 3.1. Cơ chế 1: Record and Playback (Ghi nhận & Phát lại)
Gatling cung cấp công cụ đồ họa **Gatling Recorder** để ghi nhận hành vi duyệt web và chuyển thể thành kịch bản code:

#### Cách kích hoạt Recorder:
```cmd
# Khởi chạy qua script có sẵn trong gatling-eshop:
run_recorder.bat

# Hoặc qua lệnh Maven:
mvn gatling:recorder
```

#### Hai chế độ hoạt động của Gatling Recorder:
1. **HTTP Proxy Mode:**
   - Recorder đóng vai trò một proxy trung gian lắng nghe tại cổng `8000`.
   - Cấu hình proxy trên trình duyệt (Firefox / Chrome) trỏ về `localhost:8000`.
   - Người kiểm thử thao tác đăng nhập, tìm kiếm, mua hàng trên giao diện EShop (`http://localhost:3000`).
   - Nhấn **Stop** trên Recorder; công cụ sẽ tự động xuất mã nguồn `EShopRecordedSimulation.java`.
2. **HAR Converter Mode (Chuyển đổi từ tệp HAR):**
   - Không cần thiết lập proxy phức tạp.
   - Mở DevTools của Chrome/Edge (F12) -> Tab Network -> Thao tác trên web -> Nhấn nút **Export HAR** lưu thành `eshop_session.har`.
   - Mở Gatling Recorder, chọn **Recorder mode: HAR Converter**.
   - Chọn đường dẫn đến tệp `k6-eshop/eshop_session.har`.
   - Nhấn **Start!** -> Gatling lập tức biên dịch toàn bộ chuỗi request trong HAR thành mã Java Simulation hoàn chỉnh!

---

### 3.2. Cơ chế 2: Data-Driven Testing (Kiểm thử Hướng Dữ liệu)
Khi tải cao, nếu tất cả các VU đều dùng chung 1 tài khoản (`test@eshop.com`), hệ thống EShop sẽ phát sinh lỗi:
- Xung đột cập nhật giỏ hàng (`userCarts[userId]`).
- Bị từ chối mã giảm giá `SAVE10` ở lần mua thứ 2 do ràng buộc `max_uses_per_user = 1`.
- Tranh chấp ghi dòng trên bảng SQLite (`SQLITE_BUSY`).

#### Giải pháp Gatling Feeder:
Gatling hỗ trợ cơ chế nạp dữ liệu tách rời `users.csv`:
```java
// Khai báo feeder dạng xoay vòng tròn (circular) hoặc hàng đợi (queue)
FeederBuilder<String> userFeeder = csv("users.csv").circular();

// Nạp dữ liệu vào phiên làm việc của từng VU
ScenarioBuilder scn = scenario("EShop User Flow")
    .feed(userFeeder) // Inject các biến: #{email}, #{password}, #{id}
    .exec(
        http("Login")
            .post("/api/login")
            .body(StringBody("{\"email\": \"#{email}\", \"password\": \"#{password}\"}"))
    );
```
Mỗi VU khi được khởi tạo sẽ nhận một cặp `email` / `password` hoàn toàn độc lập, đảm bảo tính cô lập dữ liệu chuẩn ISTQB.

---

### 3.3. Cơ chế 3: Checkpoints & Assertions (Điểm kiểm tra & Tiêu chí Chấp nhận)

Gatling phân định rõ ràng giữa **Check** (cấp độ từng Request) và **Assertion** (cấp độ toàn bộ Kịch bản/SLO):

#### A. Request Checkpoints & Dynamic Correlation:
Kiểm tra mã trạng thái, nội dung phản hồi JSON và trích xuất dữ liệu động truyền tiếp:
```java
.exec(
    http("1. POST /api/login")
        .post("/api/login")
        .body(StringBody("{\"email\": \"#{email}\", \"password\": \"#{password}\"}"))
        // Checkpoint 1: Mã phản hồi bắt buộc là 200
        .check(status().is(200))
        // Checkpoint 2 & Correlation: Bóc tách JWT Token lưu vào Session
        .check(jsonPath("$.token").saveAs("authToken"))
        // Checkpoint 3: Bóc tách ID người dùng
        .check(jsonPath("$.user.id").saveAs("userId"))
)
```
Dữ liệu JWT trích xuất được tái sử dụng ngay trong các request tiếp theo bằng cú pháp EL:
```java
.header("Authorization", "Bearer #{authToken}")
```

#### B. Simulation Global Assertions (SLO Verification):
Đo lường các chỉ số SLA/SLO của bài toán đề ra (P95 < 500ms, Error < 1%):
```java
setUp(
    baselineScenario.injectOpen(rampUsers(50).during(Duration.ofSeconds(30)))
).protocols(httpProtocol)
 .assertions(
     global().responseTime().percentile3().lt(500), // P95 response time < 500ms
     global().failedRequests().percent().lt(1.0)    // Tỷ lệ lỗi toàn cục < 1%
 );
```
Nếu bất kỳ chỉ số nào vượt ngưỡng, Gatling sẽ đánh dấu kịch bản thất bại (`BUILD FAILURE`), rất thuận tiện khi tích hợp vào CI/CD Pipeline.

---

## 4. Chi tiết 3 Kịch bản Thực nghiệm (3 Scenarios)

Thư mục `gatling-eshop/src/test/java/eshop/` cài đặt 3 kịch bản theo đúng yêu cầu đề tài:

| Kịch bản | Tệp mã nguồn | Concurrency & Thời gian | Mục tiêu kỹ thuật |
|---|---|---|---|
| **Scenario 1: Smoke Test** | `SmokeSimulation.java` | 1 VU - 1 lượt thực thi duy nhất | Sanity check toàn bộ 7 API, kiểm tra correlation token và orderId |
| **Scenario 2: Baseline Load** | `BaselineLoadSimulation.java` | 50 VU - 5 phút (Ramp-up 30s) | Mô hình lưu lượng thực tế 70/25/5 với think time, xác thực SLO |
| **Scenario 3: Spike Test** | `SpikeSimulation.java` | Tăng đột biến từ 5 lên 120 VU/s | Tìm điểm nghẽn chịu tải, kiểm tra cơ chế khóa SQLite và khả năng phục hồi |

---

### Scenario 1: `SmokeSimulation.java` (Sanity Check 7 API)
Kịch bản tuần tự mô phỏng hành trình đầy đủ của 1 khách hàng:
1. `POST /api/login` -> Đăng nhập, trích xuất `authToken` và `userId`.
2. `GET /api/products?search=phone` -> Tìm kiếm danh mục điện thoại.
3. `GET /api/products/1` -> Xem chi tiết sản phẩm iPhone 15 Pro Max.
4. `POST /api/cart` -> Thêm sản phẩm vào giỏ hàng (kèm Bearer Token).
5. `POST /api/apply-coupon` -> Áp dụng mã giảm giá `SAVE10`.
6. `POST /api/checkout` -> Đặt đơn hàng, bóc tách `orderId` vừa sinh.
7. `GET /api/orders/my-orders` -> Kiểm tra đơn hàng mới xuất hiện ở đầu lịch sử.

---

### Scenario 2: `BaselineLoadSimulation.java` (Realistic Workload 70/25/5)
Áp dụng phân bổ hành vi người dùng trực tuyến theo tiêu chuẩn bài toán:
- **70% Browse & Search:** Người dùng chỉ lướt xem danh sách (`/api/products?search=phone`).
- **25% Product Detail:** Người dùng đọc thông số kỹ thuật chi tiết (`/api/products/:id`).
- **5% Purchase Flow:** Người dùng thực hiện chuỗi giao dịch trọn vẹn (Cart -> Coupon -> Checkout -> Order History).

Cơ chế phân nhánh được thực hiện thông qua `randomSwitch()`:
```java
.during(Duration.ofMinutes(5)).on(
    randomSwitch().on(
        Choice.withWeight(70.0, browseBranch),
        Choice.withWeight(25.0, detailBranch),
        Choice.withWeight(5.0, checkoutBranch)
    )
)
```

---

### Scenario 3: `SpikeSimulation.java` (Flash Sale Traffic Spike)
Mô phỏng đợt mở bán chớp nhoáng (Flash Sale) để kiểm tra khả năng phục hồi của backend Node.js + SQLite:
1. **Trạng thái ổn định:** 5 users/giây trong 15s.
2. **Bùng nổ tải:** Tăng đột biến từ 5 lên 120 users/giây chỉ trong 5s (gấp 24 lần lưu lượng).
3. **Đỉnh tải (Plateau):** Duy trì 120 users/giây trong 20s.
4. **Hạ tải:** Giảm nhanh về 5 users/giây trong 5s.
5. **Hồi phục (Cooldown):** Theo dõi hệ thống trong 15s tiếp theo xem p95 latency có quay về trạng thái bình thường hay không.

---

## 5. Hướng dẫn Phân tích Báo cáo HTML của Gatling

Sau khi chạy xong, Gatling tự động xuất báo cáo HTML cực kỳ trực quan tại thư mục:
`target/gatling/eshop-<simulation>-<timestamp>/index.html`

### Các biểu đồ then chốt cần chú ý:
1. **Response Time Distribution (Biểu đồ phân phối thời gian):**
   - Màu xanh lam: Các request có phản hồi nhanh (< 500ms - Đạt chuẩn SLO).
   - Màu vàng: Phản hồi chấp nhận được (500ms - 1000ms).
   - Màu cam: Phản hồi chậm (> 1000ms).
   - Màu đỏ (KO): Các request bị lỗi HTTP (4xx, 5xx) hoặc timeout.
2. **Response Time Percentiles over Time:**
   - Đồ thị đường theo dõi biến thiên của **P50 (Median)**, **P75**, **P95**, và **P99** theo từng giây.
   - Giúp phát hiện tức thì thời điểm xuất hiện hiện tượng trễ cục bộ (latency spike).
3. **Number of Active Users over Time:**
   - Theo dõi số lượng người dùng ảo đang hoạt động đồng thời trên hệ thống.
4. **Requests per Second (Throughput):**
   - Tần suất request hệ thống xử lý được mỗi giây. Nếu tải tăng nhưng Throughput đi ngang hoặc giảm mạnh, đó là dấu hiệu của **Bottleneck** (nghẽn I/O hoặc CPU bão hòa).

---

## 6. Bảng So sánh Chuyên sâu: Gatling vs Apache JMeter vs Grafana k6

Dưới đây là bảng so sánh 3 công cụ được khảo sát trong đề tài Seminar:

| Tiêu chí so sánh | Apache JMeter | Grafana k6 | Gatling |
|---|---|---|---|
| **Kiến trúc luồng (Engine)** | 1 Thread = 1 VU (Chặn I/O) | Goroutines (Go non-blocking) | Akka Actor + Netty (Reactive Async) |
| **Tiêu tốn tài nguyên (RAM/CPU)** | Rất cao (1000 VU tốn ~2-4GB RAM) | Rất thấp (1000 VU tốn ~150-250MB) | Thấp (1000 VU tốn ~300-500MB) |
| **Giao diện cấu hình (GUI)** | GUI Swing đầy đủ, kéo thả trực quan | Không có GUI chính thức (CLI thuần) | Recorder GUI để bắt gói tin & HAR |
| **Dạng kịch bản (Scripting)** | Tệp XML (`.jmx`) phức tạp | JavaScript ES6 (`.js`) dễ đọc | Java / Scala / Kotlin / TS |
| **Khả năng AI Augmentation** | Kém (Khó yêu cầu AI sinh file XML chuẩn) | Rất cao (AI sinh mã JS cực chuẩn) | Cao (AI viết mã Java/DSL rất chuẩn xác) |
| **Báo cáo kết quả** | Cần xuất lệnh tạo HTML Dashboard | Báo cáo CLI + Cloud / Datadog | Tự động sinh báo cáo HTML Highcharts cực đẹp |
| **Hỗ trợ CI/CD & Git** | Khó merge code XML, dễ xung đột Git | Cực kỳ thuận lợi (Code-as-Test) | Cực kỳ thuận lợi (Maven/Gradle Plugin) |
| **Điểm yếu lớn nhất** | GUI hao tốn tài nguyên, dễ OOM | Hạn chế thư viện Node.js bên ngoài | Cần môi trường JVM (Java) |

---

## 7. Các lỗi thường gặp & Cách khắc phục (Troubleshooting)

1. **Lỗi `java.lang.OutOfMemoryError` khi chạy tải lớn (> 5.000 VU):**
   - Thiết lập tăng dung lượng Heap cho JVM:
     ```cmd
     set JAVA_OPTS=-Xms1024m -Xmx4096m
     ```
2. **Lỗi `403 Forbidden` ở các API sau Login:**
   - Nguyên nhân: Chưa lưu được Token từ `POST /api/login`.
   - Kiểm tra xem JSONPath `$.token` có lấy đúng key không, và header `Authorization` có tiền tố `Bearer #{authToken}` chưa.
3. **Lỗi `400 Bad Request` ở API Coupon `SAVE10`:**
   - Ràng buộc của EShop: Coupon `SAVE10` yêu cầu `total_amount > 300000` và mỗi `user_id` chỉ được dùng 1 lần (`max_uses_per_user = 1`).
   - Đảm bảo kịch bản sử dụng Feeder `users.csv` xoay vòng và truyền đúng `#{userId}` vào body.
