import assert from "node:assert/strict";
import {
  calculateCutoffBoundaries,
  generateCategories,
  buildChartSeries,
  calculateBacktestMetrics,
  RawSalesPayload,
} from "../../src/components/ecommerce/StatisticsChart";
import { MonthlySalesBucket } from "../../src/app/api/ventas/cantidad/route";

console.log("--- Running Interactive Forecast & Backtesting Unit Tests ---");

// Test 1: Feature 5 - Scenario 5.3: Minimum cutoff enforcement
console.log("Test 1: Scenario 5.3 - Minimum cutoff enforcement (first positive index + 1)");
{
  const data = [0, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150];
  const boundaries = calculateCutoffBoundaries(data);
  assert.equal(boundaries.canTimeTravel, true, "canTimeTravel should be true with 11 positive months");
  assert.equal(boundaries.positiveIndices[0], 1, "firstPositiveIdx should be index 1");
  assert.equal(boundaries.kMin, 2, "kMin should be max(1, 1 + 1) = 2");
}

{
  const allPositive = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
  const boundaries = calculateCutoffBoundaries(allPositive);
  assert.equal(boundaries.canTimeTravel, true);
  assert.equal(boundaries.kMin, 1, "kMin should be 1 when index 0 is positive");
}
console.log("✓ Test 1 Passed\n");

// Test 2: Feature 5 - Scenario 5.1 & 5.2: Boundary safeguarding with sparse history
console.log("Test 2: Scenarios 5.1 & 5.2 - Safeguards with sparse or all-zero history");
{
  // Only 1 positive month
  const sparseData = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100];
  const boundaries = calculateCutoffBoundaries(sparseData);
  assert.equal(boundaries.canTimeTravel, false, "canTimeTravel must be false with < 2 positive points");
  assert.equal(boundaries.kMin, 11, "kMin must be clamped to N-1 (11)");
}

{
  // All zeroes
  const allZeroes = Array(12).fill(0);
  const boundaries = calculateCutoffBoundaries(allZeroes);
  assert.equal(boundaries.canTimeTravel, false, "canTimeTravel must be false for all-zero history");
  assert.equal(boundaries.kMin, 11, "kMin must be N-1 (11)");
}

{
  // Empty array
  const emptyBoundaries = calculateCutoffBoundaries([]);
  assert.equal(emptyBoundaries.canTimeTravel, false);
  assert.equal(emptyBoundaries.kMin, 0);
}
console.log("✓ Test 2 Passed\n");

// Test 3: Feature 2 - Timeline Categories & Forward Labels Generation
console.log("Test 3: Scenarios 2.1 & 2.2 - Categories generation and forward projections");
const sampleMonths: MonthlySalesBucket[] = [
  { year: 2025, month: 11, label: "Nov 25", shortLabel: "Nov", quantity: 100, isCurrentMonth: false },
  { year: 2025, month: 12, label: "Dic 25", shortLabel: "Dic", quantity: 120, isCurrentMonth: false },
  { year: 2026, month: 1, label: "Ene 26", shortLabel: "Ene", quantity: 110, isCurrentMonth: false },
  { year: 2026, month: 2, label: "Feb 26", shortLabel: "Feb", quantity: 130, isCurrentMonth: false },
  { year: 2026, month: 3, label: "Mar 26", shortLabel: "Mar", quantity: 140, isCurrentMonth: false },
  { year: 2026, month: 4, label: "Abr 26", shortLabel: "Abr", quantity: 150, isCurrentMonth: false },
  { year: 2026, month: 5, label: "May 26", shortLabel: "May", quantity: 160, isCurrentMonth: false },
  { year: 2026, month: 6, label: "Jun 26", shortLabel: "Jun", quantity: 170, isCurrentMonth: false },
  { year: 2026, month: 7, label: "Jul 26", shortLabel: "Jul", quantity: 180, isCurrentMonth: false },
  { year: 2026, month: 8, label: "Ago 26", shortLabel: "Ago", quantity: 190, isCurrentMonth: false },
  { year: 2026, month: 9, label: "Sep 26", shortLabel: "Sep", quantity: 200, isCurrentMonth: false },
  { year: 2026, month: 10, label: "Oct 26", shortLabel: "Oct", quantity: 210, isCurrentMonth: true },
];
const sampleLabels = sampleMonths.map((m) => m.label);

{
  // Present cutoff (K=11) with Horizon 3 -> T = max(12, 11 + 3 + 1) = 15
  const result = generateCategories(sampleLabels, sampleMonths, 11, 3);
  assert.equal(result.totalLength, 15, "totalLength should be 15");
  assert.equal(result.categories.length, 15, "categories length should match totalLength");
  assert.equal(result.categories[11], "Oct 26", "Index 11 should be Oct 26");
  assert.equal(result.categories[12], "Nov 26 (P)", "Index 12 should be Nov 26 (P)");
  assert.equal(result.categories[13], "Dic 26 (P)", "Index 13 should be Dic 26 (P)");
  assert.equal(result.categories[14], "Ene 27 (P)", "Index 14 should roll over to Ene 27 (P)");
}

{
  // Present cutoff (K=11) with Horizon 1 -> T = 13
  const result = generateCategories(sampleLabels, sampleMonths, 11, 1);
  assert.equal(result.totalLength, 13);
  assert.equal(result.categories.length, 13);
  assert.equal(result.categories[12], "Nov 26 (P)");
}

{
  // Past cutoff inside history (K=5, Horizon 3) -> T = max(12, 5 + 3 + 1) = 12
  const result = generateCategories(sampleLabels, sampleMonths, 5, 3);
  assert.equal(result.totalLength, 12, "When K+H <= N-1, totalLength should remain N (12)");
  assert.equal(result.categories.length, 12);
  assert.deepEqual(result.categories, sampleLabels, "Categories should match raw labels exactly");
}

{
  // Scenario 2.1: Past cutoff extending into future (K=9, Horizon 6) -> T = max(12, 9 + 6 + 1) = 16
  const result = generateCategories(sampleLabels, sampleMonths, 9, 6);
  assert.equal(result.totalLength, 16);
  assert.equal(result.categories.length, 16);
  assert.equal(result.categories[11], "Oct 26");
  assert.equal(result.categories[12], "Nov 26 (P)");
  assert.equal(result.categories[13], "Dic 26 (P)");
  assert.equal(result.categories[14], "Ene 27 (P)");
  assert.equal(result.categories[15], "Feb 27 (P)");
}
console.log("✓ Test 3 Passed\n");

// Test 4: Feature 3 - Series Assembly, Continuity Anchor Stitching & Null Padding
console.log("Test 4: Scenarios 3.1, 3.2, 3.3 - Series Assembly & Anchor Stitching");
{
  const rawData = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
  const forecast = [130, 140, 150];
  const K = 7; // Cutoff at index 7
  const H = 3;
  const T = 12; // 7 + 3 + 1 = 11 <= 12

  const series = buildChartSeries(rawData, forecast, K, H, T, false);
  assert.equal(series.length, 2);
  assert.equal(series[0].name, "Ventas Reales");
  assert.equal(series[1].name, "Pronóstico Simulado");

  const sReal = series[0].data;
  const sForecast = series[1].data;

  assert.equal(sReal.length, T);
  assert.equal(sForecast.length, T);

  // Check Anchor Stitch at K = 7
  assert.equal(sReal[7], 80, "Real series at K=7 should be 80");
  assert.equal(sForecast[7], 80, "Forecast series at K=7 MUST be stitched with real value 80");

  // Check Null padding before anchor
  for (let i = 0; i < 7; i++) {
    assert.equal(sForecast[i], null, `Forecast series at index ${i} should be null`);
  }

  // Check Forecast projections at K+1..K+H
  assert.equal(sForecast[8], 130, "Forecast at K+1 should be forecast[0]");
  assert.equal(sForecast[9], 140, "Forecast at K+2 should be forecast[1]");
  assert.equal(sForecast[10], 150, "Forecast at K+3 should be forecast[2]");

  // Check Null padding after forecast up to T
  assert.equal(sForecast[11], null, "Forecast at index 11 should be null");
}

{
  // Test present series naming
  const seriesPresent = buildChartSeries([100], [110], 0, 1, 2, true);
  assert.equal(seriesPresent[1].name, "Pronóstico (Holt-Winters)");
}
console.log("✓ Test 4 Passed\n");

// Test 5: Feature 4 - Backtesting Metrics Scenarios
console.log("Test 5: Scenarios 4.1 to 4.4 - Backtesting Accuracy & Edge Cases");
{
  // Scenario 4.1: Accurate backtesting calculation across overlap (delta=0, accuracy=100.0%)
  const rawPayload: RawSalesPayload = {
    data: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 80],
    labels: sampleLabels,
    months: sampleMonths,
  };
  // K = 8, H = 3. Real at indices 9, 10, 11 are [100, 120, 80] -> sum = 300.
  // Forecast: [105, 115, 80] -> sum = 300.
  const metrics = calculateBacktestMetrics(rawPayload, 8, 3, [105, 115, 80]);
  assert.ok(metrics !== null, "Metrics should not be null for past cutoff");
  assert.equal(metrics.evalLength, 3, "evalLength should be 3");
  assert.equal(metrics.realUnits, 300, "realUnits should be 300");
  assert.equal(metrics.forecastUnits, 300, "forecastUnits should be 300");
  assert.equal(metrics.delta, 0, "delta should be 0");
  assert.equal(metrics.absErrorPct, 0, "absErrorPct should be 0%");
  assert.equal(metrics.accuracyPct, 100, "accuracyPct should be 100.0%");
  assert.equal(metrics.isPartial, false, "isPartial should be false");
}

{
  // Scenario 4.2: Overlap with over-estimation delta (+20 units, 90.0% accuracy)
  const rawPayload: RawSalesPayload = {
    data: [10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100, 100],
    labels: sampleLabels,
    months: sampleMonths,
  };
  // K = 9, H = 2. Overlap indices: 10, 11. Real: [100, 100] -> sum = 200.
  // Forecast: [110, 110] -> sum = 220.
  const metrics = calculateBacktestMetrics(rawPayload, 9, 2, [110, 110]);
  assert.ok(metrics !== null);
  assert.equal(metrics.evalLength, 2);
  assert.equal(metrics.realUnits, 200);
  assert.equal(metrics.forecastUnits, 220);
  assert.equal(metrics.delta, 20, "delta should be +20");
  assert.equal(metrics.absErrorPct, 10, "absErrorPct should be 10%");
  assert.equal(metrics.accuracyPct, 90, "accuracyPct should be 90%");
  assert.equal(metrics.isPartial, false);
}

{
  // Scenario 4.3: Zero-division safety when real sales in overlap are 0
  const rawPayload: RawSalesPayload = {
    data: [10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 0, 0],
    labels: sampleLabels,
    months: sampleMonths,
  };
  // K = 9, H = 2. Real: [0, 0] -> sum = 0. Forecast: [10, 5] -> sum = 15.
  const metrics = calculateBacktestMetrics(rawPayload, 9, 2, [10, 5]);
  assert.ok(metrics !== null);
  assert.equal(metrics.evalLength, 2);
  assert.equal(metrics.realUnits, 0);
  assert.equal(metrics.forecastUnits, 15);
  assert.equal(metrics.delta, 15);
  assert.equal(Number.isFinite(metrics.absErrorPct), true, "absErrorPct must be finite");
  assert.equal(Number.isFinite(metrics.accuracyPct), true, "accuracyPct must be finite");
  assert.equal(metrics.absErrorPct, 100);
  assert.equal(metrics.accuracyPct, 0);
}

{
  // Scenario 4.4: Complete zero-match in overlap
  const rawPayload: RawSalesPayload = {
    data: [10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 0, 0],
    labels: sampleLabels,
    months: sampleMonths,
  };
  const metrics = calculateBacktestMetrics(rawPayload, 9, 2, [0, 0]);
  assert.ok(metrics !== null);
  assert.equal(metrics.realUnits, 0);
  assert.equal(metrics.forecastUnits, 0);
  assert.equal(metrics.delta, 0);
  assert.equal(metrics.accuracyPct, 100);
}

{
  // Scenario 2.1 partial overlap: K = 9, H = 6, N = 12 -> overlap indices 10, 11 (mEval = 2 < 6)
  const rawPayload: RawSalesPayload = {
    data: [10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100, 120],
    labels: sampleLabels,
    months: sampleMonths,
  };
  const metrics = calculateBacktestMetrics(rawPayload, 9, 6, [100, 120, 130, 140, 150, 160]);
  assert.ok(metrics !== null);
  assert.equal(metrics.evalLength, 2, "mEval should be 2");
  assert.equal(metrics.isPartial, true, "isPartial should be true when mEval < H");
  assert.equal(metrics.evalSpan, `${sampleLabels[10]} - ${sampleLabels[11]}`);
}

{
  // Present cutoff should return null metrics
  const rawPayload: RawSalesPayload = {
    data: [10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100, 120],
    labels: sampleLabels,
    months: sampleMonths,
  };
  const metrics = calculateBacktestMetrics(rawPayload, 11, 3, [130, 140, 150]);
  assert.equal(metrics, null, "Present cutoff (K=11) should return null metrics");
}
console.log("✓ Test 5 Passed\n");

console.log("=======================================================");
console.log("ALL INTERACTIVE FORECAST & BACKTESTING UNIT TESTS PASSED!");
console.log("=======================================================");
