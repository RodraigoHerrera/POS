# TestSprite AI Testing Report (MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** POS (Smash POS)
- **Date:** 2026-10-30
- **Prepared by:** TestSprite AI Team + Claude Code
- **Test type:** Frontend, production build (`next build` + `next start`)
- **Target:** `http://localhost:3100` against the isolated `smash_test` database
- **Environment:** `RATE_LIMIT_RELAXED=true` (only honored on `_test` databases), DB host `127.0.0.1` with `connect_timeout=30`, one seeded branch per test case (`tc001@smash.test` … `tc050@smash.test`)
- **This run (run 4):** 25 cases — the 20 never-executed cases (TC031–TC050) plus 5 re-checks (TC006, TC007, TC009, TC015, TC021) after PR #29

### Run history
| Run | Scope | Passed | Notes |
|---|---|---|---|
| 1 | TC001–TC030 | 10/30 | Shared branch, default rate limits |
| 2 | TC001–TC030 | 12/30 | Per-test branches, tests could not map their TC number |
| 3 | TC001–TC030 | 25/30 | Explicit title → credentials table |
| **4** | **TC031–TC050 + 5 re-checks** | **20/25** | Register opening fix (PR #29) confirmed |

**Combined coverage:** 45 of the 50 planned cases have passed in at least one run (TC001–TC037, TC039–TC044, TC048 plus the 5 re-checks).

---

## 2️⃣ Requirement Validation Summary

### Requirement: Cash register (re-check after PR #29)
| Test | Title | Status |
|---|---|---|
| TC006 | Open the register and start cashier operations | ✅ Passed |
| TC007 | Open the cash register and reach the POS screen | ✅ Passed |
| TC015 | Close the cash register and end the cashier session | ✅ Passed |

**Analysis:** All three failed in run 3 with the "Ya tienes una caja abierta" loop. They pass now that a 409 continues to `/cajero/ventas`.

### Requirement: Payments and order recovery
| Test | Title | Status |
|---|---|---|
| TC009 | Complete payment for an open order | ✅ Passed |
| TC021 | Resume charging an open order | ✅ Passed |
| TC033 | View open orders and reprint a kitchen ticket | ✅ Passed |
| TC034 | Void an open order from the recovery flow | ✅ Passed |
| TC037 | Void an unpaid order from payment | ✅ Passed |
| TC040 | Clear an in-progress order from the cart | ✅ Passed |
| TC048 | Show validation when cash received is insufficient | ✅ Passed |

### Requirement: Employee management
| Test | Title | Status |
|---|---|---|
| TC032 | Manage employees from the administrator area | ✅ Passed |
| TC035 | Create a new employee | ✅ Passed |
| TC039 | Browse employee management | ✅ Passed |
| TC043 | Deactivate and reactivate an employee | ✅ Passed |

### Requirement: Inventory
| Test | Title | Status |
|---|---|---|
| TC036 | Review and adjust inventory from the administrator area | ✅ Passed |
| TC038 | Register an inventory movement | ❌ Failed |
| TC041 | Record a stock loss | ✅ Passed |
| TC044 | Record inventory movement and inspect stock controls | ✅ Passed |

**Analysis (TC038, app bug):** `POST /api/inventarios/registrarEntrada` returned 500. Server log: `P2002 Unique constraint failed on lote_item_id_codigo_lote_key` in `prisma.lote.create()`. The "Lote" field in `EntradaModal` is optional and defaults to `""`, and lot codes are unique per item **across all branches**. The first entry without a lot code for an item succeeds; every later one (in any branch) fails with 500. TC044 had already registered a blank-code entry for the same item.

### Requirement: Dashboard and reports
| Test | Title | Status |
|---|---|---|
| TC031 | Review dashboard in monthly view | ✅ Passed |
| TC042 | Inspect sales and export the report as CSV | ✅ Passed |
| TC045 | Download sales report CSV | BLOCKED |

**Analysis:** TC045's branch had no sales in the selected range and "Descargar CSV" timed out in the test browser. TC042 covers the same export with data and passed. Test data, not a confirmed app bug.

### Requirement: Production and MRP
| Test | Title | Status |
|---|---|---|
| TC046 | Run MRP planning and review replenishment results | ❌ Failed |
| TC047 | Run a production batch from available ingredients | BLOCKED |
| TC049 | Run a production batch | BLOCKED |
| TC050 | Plan production and validate replenishment decisions | BLOCKED |

**Analysis:** The test seed has no `prep` item with a recipe ("No hay preparaciones con receta"), and a fresh branch has no sales history, so MRP has nothing to forecast. Test data gap, not a confirmed app bug.

---

## 3️⃣ Coverage & Matching Metrics

- **80%** of this run's tests passed (20 / 25). 0 rate-limit blocks and 0 DB-connect errors in the server log.

| Requirement | Total Tests | ✅ Passed | ❌ Failed | Blocked |
|---|---|---|---|---|
| Cash register (re-check) | 3 | 3 | 0 | 0 |
| Payments and order recovery | 7 | 7 | 0 | 0 |
| Employee management | 4 | 4 | 0 | 0 |
| Inventory | 4 | 3 | 1 | 0 |
| Dashboard and reports | 3 | 2 | 0 | 1 |
| Production and MRP | 4 | 0 | 1 | 3 |
| **Total** | **25** | **20** | **2** | **3** |

---

## 4️⃣ Key Gaps / Risks

1. **Inventory entry without a lot code fails after the first one (app bug, high impact):** blank `codigo_lote` collides on `lote_item_id_codigo_lote_key`, which is global per item across branches, and the API answers 500. In real use, a second entry of the same item without a lot code fails in any branch. Needs an auto-generated code when blank and a 409 with a clear message on real duplicates.
2. **Production and MRP untested:** the seed needs a `prep` item with a recipe and some sales history per branch before TC046, TC047, TC049 and TC050 can run.
3. **TC045:** re-run with sales data in range to confirm the CSV download.
4. **Known limitations from the code summary** (not exercised): sidebar links to `/admin/gastos` and 4 Reportes pages return 404; every order is saved as "Mesa 1".
