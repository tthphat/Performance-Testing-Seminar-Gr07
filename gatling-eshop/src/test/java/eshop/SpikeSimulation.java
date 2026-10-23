package eshop;

import io.gatling.javaapi.core.*;
import io.gatling.javaapi.http.*;
import java.time.Duration;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

/**
 * SpikeSimulation (Scenario 3 - Spike / Stress Test)
 * 
 * Target: EShop Backend (Node.js + SQLite)
 * Purpose: Test system resilience, bottleneck threshold, and SQLite concurrency limits (SQLITE_BUSY)
 *          under an instantaneous traffic surge (Flash Sale simulation).
 * Profile:
 *   1. Warmup / Normal: 5 users/s for 15s
 *   2. Spike Surge: Ramp from 5 to 120 users/s in 5s
 *   3. Peak Plateau: 120 users/s sustained for 20s
 *   4. Recovery: Drop back to 5 users/s in 5s
 *   5. Cooldown: 5 users/s for 15s to check system stabilization
 */
public class SpikeSimulation extends Simulation {

    private final HttpProtocolBuilder httpProtocol = http
        .baseUrl(System.getProperty("baseUrl", "http://localhost:3000"))
        .acceptHeader("application/json")
        .contentTypeHeader("application/json")
        .userAgentHeader("Gatling/3.10.5 (EShop-SpikeTest-FlashSale)");

    private final FeederBuilder<String> userFeeder = csv("users.csv").circular();

    // Fast shopping cart & checkout flow simulating high-contention flash sale
    private final ScenarioBuilder flashSaleScenario = scenario("EShop Flash Sale Spike User")
        .feed(userFeeder)
        
        // Quick Authentication
        .exec(
            http("1. POST /api/login (Spike)")
                .post("/api/login")
                .body(StringBody("{\"email\": \"#{email}\", \"password\": \"#{password}\"}"))
                .check(status().in(200, 429, 503))
                .check(jsonPath("$.token").optional().saveAs("authToken"))
                .check(jsonPath("$.user.id").optional().saveAs("userId"))
        )
        .pause(Duration.ofMillis(200), Duration.ofMillis(600))

        // High contention Catalog Search
        .exec(
            http("2. GET /api/products?search= (Spike)")
                .get("/api/products?search=phone")
                .check(status().in(200, 500, 503))
        )
        .pause(Duration.ofMillis(200), Duration.ofMillis(600))

        // High contention Checkout attempt (Triggers write transaction lock on SQLite orders table)
        .doIf(session -> session.contains("authToken")).then(
            exec(
                http("3. POST /api/checkout (Spike Contention)")
                    .post("/api/checkout")
                    .header("Authorization", "Bearer #{authToken}")
                    .body(StringBody("{\"total_amount\": 30000000, \"shipping_address\": \"Flash Sale Flash Zone\"}"))
                    .check(status().in(200, 500, 503))
            )
        );

    // Open Workload Injection Model for Traffic Spike
    {
        setUp(
            flashSaleScenario.injectOpen(
                constantUsersPerSec(5).during(Duration.ofSeconds(15)),       // Step 1: Normal steady state
                rampUsersPerSec(5).to(120).during(Duration.ofSeconds(5)),    // Step 2: Sudden 24x traffic explosion
                constantUsersPerSec(120).during(Duration.ofSeconds(20)),     // Step 3: Peak plateau
                rampUsersPerSec(120).to(5).during(Duration.ofSeconds(5)),    // Step 4: Traffic drops back
                constantUsersPerSec(5).during(Duration.ofSeconds(15))        // Step 5: Post-spike recovery monitoring
            )
        ).protocols(httpProtocol)
         .assertions(
             global().responseTime().percentile3().lt(2000), // P95 under spike stress < 2000ms
             global().failedRequests().percent().lt(15.0)    // Peak error rate threshold
         );
    }
}
