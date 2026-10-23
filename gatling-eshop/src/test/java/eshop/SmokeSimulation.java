package eshop;

import io.gatling.javaapi.core.*;
import io.gatling.javaapi.http.*;
import java.time.Duration;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

/**
 * SmokeSimulation (Scenario 1 - Baseline / Sanity Check)
 * 
 * Target: EShop Backend (Node.js + SQLite)
 * Purpose: Verify functional correctness and performance baseline for 1 Virtual User (VU)
 *          across all 7 critical business endpoints with dynamic JWT correlation and checkpoints.
 */
public class SmokeSimulation extends Simulation {

    // HTTP Protocol Configuration
    private final HttpProtocolBuilder httpProtocol = http
        .baseUrl(System.getProperty("baseUrl", "http://localhost:3000"))
        .acceptHeader("application/json")
        .contentTypeHeader("application/json")
        .userAgentHeader("Gatling/3.10.5 (EShop-SmokeTest-1VU)");

    // Data-Driven Feeder: Load user credentials from users.csv
    private final FeederBuilder<String> userFeeder = csv("users.csv").circular();

    // Scenario Definition: 1 User completing full E-Commerce journey
    private final ScenarioBuilder smokeScenario = scenario("EShop Smoke Test - 1 VU Full Journey")
        .feed(userFeeder)
        
        // 1. POST /api/login - Extract JWT Token and User ID
        .exec(
            http("1. POST /api/login")
                .post("/api/login")
                .body(StringBody("{\"email\": \"#{email}\", \"password\": \"#{password}\"}"))
                .check(status().is(200))
                .check(jsonPath("$.token").saveAs("authToken"))
                .check(jsonPath("$.user.id").saveAs("userId"))
        )
        .pause(Duration.ofSeconds(1))

        // 2. GET /api/products?search=phone - Product Catalog Search
        .exec(
            http("2. GET /api/products?search=")
                .get("/api/products?search=phone")
                .check(status().is(200))
                .check(jsonPath("$").isArray())
        )
        .pause(Duration.ofSeconds(1))

        // 3. GET /api/products/1 - View Product Detail
        .exec(
            http("3. GET /api/products/:id")
                .get("/api/products/1")
                .check(status().is(200))
                .check(jsonPath("$.id").is("1"))
        )
        .pause(Duration.ofSeconds(1))

        // 4. POST /api/cart - Add Item to Cart (Requires Bearer Token)
        .exec(
            http("4. POST /api/cart")
                .post("/api/cart")
                .header("Authorization", "Bearer #{authToken}")
                .body(StringBody("{\"id\": 1, \"name\": \"iPhone 15 Pro Max\", \"price\": 30000000, \"quantity\": 1}"))
                .check(status().is(200))
                .check(jsonPath("$.message").is("Added to cart"))
        )
        .pause(Duration.ofSeconds(1))

        // 5. POST /api/apply-coupon - Apply Promo Code SAVE10
        .exec(
            http("5. POST /api/apply-coupon")
                .post("/api/apply-coupon")
                .header("Authorization", "Bearer #{authToken}")
                .body(StringBody("{\"code\": \"SAVE10\", \"total_amount\": 30000000, \"user_id\": #{userId}}"))
                .check(status().is(200))
                .check(jsonPath("$.success").is("true"))
        )
        .pause(Duration.ofSeconds(1))

        // 6. POST /api/checkout - Place Order and extract Order ID
        .exec(
            http("6. POST /api/checkout")
                .post("/api/checkout")
                .header("Authorization", "Bearer #{authToken}")
                .body(StringBody("{\"total_amount\": 27000000, \"shipping_address\": \"123 Nguyen Trai, Q5, HCMC\"}"))
                .check(status().is(200))
                .check(jsonPath("$.orderId").saveAs("orderId"))
        )
        .pause(Duration.ofSeconds(1))

        // 7. GET /api/orders/my-orders - Verify Order History Checkpoint
        .exec(
            http("7. GET /api/orders/my-orders")
                .get("/api/orders/my-orders")
                .header("Authorization", "Bearer #{authToken}")
                .check(status().is(200))
                .check(jsonPath("$[0].id").is("#{orderId}"))
        );

    // Simulation Setup: 1 VU executing once
    {
        setUp(
            smokeScenario.injectOpen(atOnceUsers(1))
        ).protocols(httpProtocol)
         .assertions(
             global().successfulRequests().percent().is(100.0),
             global().responseTime().max().lt(3000)
         );
    }
}
