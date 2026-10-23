package eshop;

import io.gatling.javaapi.core.*;
import io.gatling.javaapi.http.*;
import java.time.Duration;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

/**
 * BaselineLoadSimulation (Scenario 2 - Realistic Mixed Workload)
 * 
 * Model: FIT@HCMUS Seminar T05 EShop Workload Standard
 * Ratio: 70% Product Search/Browse, 25% Product Detail View, 5% Complete Checkout Flow
 * Concurrency: 50 Virtual Users (VUs)
 * Duration: 5 minutes with 30-second smooth ramp-up
 * SLO Targets:
 *   - 95th Percentile Response Time (P95) < 500ms
 *   - HTTP Failure Rate < 1%
 */
public class BaselineLoadSimulation extends Simulation {

    private final HttpProtocolBuilder httpProtocol = http
        .baseUrl(System.getProperty("baseUrl", "http://localhost:3000"))
        .acceptHeader("application/json")
        .contentTypeHeader("application/json")
        .userAgentHeader("Gatling/3.10.5 (EShop-BaselineLoad-50VUs)");

    // Data-driven Feeder: Circular rotation across 500 user accounts
    private final FeederBuilder<String> userFeeder = csv("users.csv").circular();

    // Workload Branch 1: 70% Product Search & Browse
    private final ChainBuilder browseBranch = exec(
        http("GET /api/products?search=")
            .get("/api/products?search=phone")
            .check(status().is(200))
    ).pause(Duration.ofMillis(400), Duration.ofMillis(1200));

    // Workload Branch 2: 25% Product Detail View
    private final ChainBuilder detailBranch = exec(
        http("GET /api/products/:id")
            .get("/api/products/1")
            .check(status().is(200))
    ).pause(Duration.ofMillis(400), Duration.ofMillis(1200));

    // Workload Branch 3: 5% Full Checkout Purchase Flow
    private final ChainBuilder checkoutBranch = exec(
        // Add to Cart
        http("POST /api/cart")
            .post("/api/cart")
            .header("Authorization", "Bearer #{authToken}")
            .body(StringBody("{\"id\": 1, \"name\": \"iPhone 15 Pro Max\", \"price\": 30000000, \"quantity\": 1}"))
            .check(status().is(200))
    )
    .pause(Duration.ofMillis(500), Duration.ofMillis(1000))
    .exec(
        // Apply Coupon
        http("POST /api/apply-coupon")
            .post("/api/apply-coupon")
            .header("Authorization", "Bearer #{authToken}")
            .body(StringBody("{\"code\": \"SAVE10\", \"total_amount\": 30000000, \"user_id\": #{userId}}"))
            .check(status().in(200, 400)) // 400 if user previously used single-use coupon
    )
    .pause(Duration.ofMillis(500), Duration.ofMillis(1000))
    .exec(
        // Final Checkout
        http("POST /api/checkout")
            .post("/api/checkout")
            .header("Authorization", "Bearer #{authToken}")
            .body(StringBody("{\"total_amount\": 27000000, \"shipping_address\": \"District 5, Ho Chi Minh City\"}"))
            .check(status().is(200))
            .check(jsonPath("$.orderId").saveAs("orderId"))
    )
    .pause(Duration.ofMillis(500), Duration.ofMillis(1000))
    .exec(
        // Verify Order History
        http("GET /api/orders/my-orders")
            .get("/api/orders/my-orders")
            .header("Authorization", "Bearer #{authToken}")
            .check(status().is(200))
    );

    // Scenario Definition: Authenticate once upon VU arrival, then loop through weighted workload
    private final ScenarioBuilder baselineScenario = scenario("EShop Realistic Mixed Workload (70/25/5)")
        .feed(userFeeder)
        
        // One-time session authentication per VU
        .exec(
            http("POST /api/login")
                .post("/api/login")
                .body(StringBody("{\"email\": \"#{email}\", \"password\": \"#{password}\"}"))
                .check(status().is(200))
                .check(jsonPath("$.token").saveAs("authToken"))
                .check(jsonPath("$.user.id").saveAs("userId"))
        )
        .pause(Duration.ofSeconds(1))

        // Loop workload for 5 minutes with realistic 70 / 25 / 5 traffic distribution
        .during(Duration.ofMinutes(5)).on(
            randomSwitch().on(
                Choice.withWeight(70.0, browseBranch),
                Choice.withWeight(25.0, detailBranch),
                Choice.withWeight(5.0, checkoutBranch)
            )
        );

    // Load Simulation Profile: Ramp 50 users over 30 seconds
    {
        setUp(
            baselineScenario.injectOpen(
                rampUsers(50).during(Duration.ofSeconds(30))
            )
        ).protocols(httpProtocol)
         .assertions(
             global().responseTime().percentile3().lt(500),  // P95 < 500ms
             global().failedRequests().percent().lt(1.0)     // Error rate < 1%
         );
    }
}
