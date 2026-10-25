import assert from "node:assert/strict";
import {
  calculateSalesForecast,
  safeDiv,
  clampNonNegative,
  EPSILON,
  ForecastResult,
} from "../../src/lib/sales/forecast";

console.log("--- Running Forecast Engine Unit Tests ---");

// Test 1: Numerical Helpers
console.log("Test 1: Numerical Helpers (safeDiv, clampNonNegative)");
assert.equal(safeDiv(10, 2), 5, "safeDiv(10, 2) should equal 5");
assert.equal(safeDiv(10, 0), 1.0, "safeDiv with 0 denominator should return fallback 1.0");
assert.equal(safeDiv(10, 1e-6, 99), 99, "safeDiv below EPSILON should return fallback");
assert.equal(safeDiv(0, 0), 1.0, "safeDiv(0, 0) should return fallback 1.0");

assert.equal(clampNonNegative(15), 15, "clampNonNegative(15) should be 15");
assert.equal(clampNonNegative(-5), 0, "clampNonNegative(-5) should clamp to 0");
assert.equal(clampNonNegative(NaN), 0, "clampNonNegative(NaN) should clamp to 0");
assert.equal(clampNonNegative(-Infinity), 0, "clampNonNegative(-Infinity) should clamp to 0");
console.log("✓ Test 1 Passed\n");

// Test 2: Scenario 1 - Empty array fallback
console.log("Test 2: Scenario - Empty history fallback");
const emptyRes = calculateSalesForecast([], 3);
assert.deepEqual(emptyRes.forecast, [0, 0, 0], "Empty history should return 3 zeroes");
assert.equal(emptyRes.method, "zero_fill", "Method should be zero_fill");
assert.equal(emptyRes.confidence, "low", "Confidence should be low");
console.log("✓ Test 2 Passed\n");

// Test 3: Scenario 2 - Single data point flat fallback
console.log("Test 3: Scenario - Single data point flat fallback");
const singleRes = calculateSalesForecast([45], 3);
assert.deepEqual(singleRes.forecast, [45, 45, 45], "Single point [45] should return [45, 45, 45]");
assert.equal(singleRes.method, "flat_naive", "Method should be flat_naive");
assert.equal(singleRes.confidence, "low", "Confidence should be low");
// Test iteration support
assert.deepEqual([...singleRes], [45, 45, 45], "Result should be iterable as array");
console.log("✓ Test 3 Passed\n");

// Test 4: Scenario 3 - Short history Holt linear smoothing
console.log("Test 4: Scenario - Short history Holt linear smoothing");
const shortHistory = [10, 20, 30, 40, 50];
const shortRes = calculateSalesForecast(shortHistory, 3);
assert.equal(shortRes.forecast.length, 3, "Forecast length should be 3");
assert.equal(shortRes.method, "holt_linear", "Method should be holt_linear");
// Check upward linear trend
assert.ok(shortRes.forecast[0] > 50, `First forecast (${shortRes.forecast[0]}) should be greater than last history point (50)`);
assert.ok(shortRes.forecast[1] >= shortRes.forecast[0], "Forecast trend should be non-decreasing");
assert.ok(shortRes.forecast[2] >= shortRes.forecast[1], "Forecast trend should be non-decreasing");
shortRes.forecast.forEach((v) => {
  assert.ok(Number.isInteger(v), `Value ${v} should be an integer`);
  assert.ok(v >= 0, `Value ${v} should be non-negative`);
});
console.log(`Forecast for [10, 20, 30, 40, 50]: ${JSON.stringify(shortRes.forecast)}`);
console.log("✓ Test 4 Passed\n");

// Test 5: Scenario 4 - Steep decline clamping to zero
console.log("Test 5: Scenario - Negative trend clamping to zero");
const steepDecline = [100, 50, 10, 2];
const declineRes = calculateSalesForecast(steepDecline, 3);
assert.equal(declineRes.forecast.length, 3, "Forecast length should be 3");
assert.equal(declineRes.method, "holt_linear", "Method should be holt_linear");
declineRes.forecast.forEach((v) => {
  assert.equal(v, 0, `Extrapolated steep drop should clamp to 0, got ${v}`);
});
console.log(`Forecast for [100, 50, 10, 2]: ${JSON.stringify(declineRes.forecast)}`);
console.log("✓ Test 5 Passed\n");

// Test 6: Scenario 5 - 12-Month seasonal Holt-Winters
console.log("Test 6: Scenario - 12-Month seasonal Holt-Winters");
const seasonalHistory = [100, 120, 110, 130, 150, 170, 200, 190, 160, 140, 130, 180];
const seasonalRes = calculateSalesForecast(seasonalHistory, 3);
assert.equal(seasonalRes.forecast.length, 3, "Forecast length should be 3");
assert.equal(seasonalRes.method, "holt_winters_multiplicative", "Method should be holt_winters_multiplicative");
assert.equal(seasonalRes.confidence, "high", "Confidence should be high");
seasonalRes.forecast.forEach((v) => {
  assert.ok(Number.isInteger(v), `Value ${v} should be an integer`);
  assert.ok(v >= 0, `Value ${v} should be non-negative`);
  assert.ok(Number.isFinite(v), `Value ${v} should be finite`);
});
console.log(`Seasonal 12-month forecast: ${JSON.stringify(seasonalRes.forecast)}`);
console.log("✓ Test 6 Passed\n");

// Test 7: Scenario 6 - 12-Month all zeroes history
console.log("Test 7: Scenario - 12-Month all zeroes history");
const allZeroes = Array(12).fill(0);
const zeroRes = calculateSalesForecast(allZeroes, 3);
assert.deepEqual(zeroRes.forecast, [0, 0, 0], "All zeroes should return [0, 0, 0]");
assert.equal(zeroRes.method, "zero_fill", "Method should be zero_fill");
zeroRes.forecast.forEach((v) => {
  assert.ok(!isNaN(v), `Value should not be NaN`);
  assert.equal(v, 0, `Value should be 0`);
});
console.log("✓ Test 7 Passed\n");

// Test 8: Leading Zeroes Stripping
console.log("Test 8: Leading zeroes stripping");
const leadingZeroes = [0, 0, 0, 0, 45];
const strippedRes = calculateSalesForecast(leadingZeroes, 3);
assert.deepEqual(strippedRes.forecast, [45, 45, 45], "Leading zeroes before 45 should be stripped to flat 45");
assert.equal(strippedRes.method, "flat_naive", "Method should be flat_naive");
console.log("✓ Test 8 Passed\n");

// Test 9: Object options polymorphism
console.log("Test 9: Object options polymorphism");
const optionsRes = calculateSalesForecast(shortHistory, { horizon: 4, alpha: 0.4 });
assert.equal(optionsRes.forecast.length, 4, "Should respect options.horizon = 4");
assert.equal(optionsRes.params.alpha, 0.4, "Should respect options.alpha = 0.4");
console.log("✓ Test 9 Passed\n");

console.log("==========================================");
console.log("ALL 9 UNIT TESTS PASSED SUCCESSFULLY!");
console.log("==========================================");
