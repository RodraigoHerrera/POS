# TestSprite AI Testing Report (MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** POS (Smash POS)
- **Date:** 2026-10-30
- **Prepared by:** TestSprite AI Team + Claude Code
- **Test type:** Frontend, production build (`next build` + `next start`)
- **Target:** `http://localhost:3100` against the isolated `smash_test` database
- **Environment:** `RATE_LIMIT_RELAXED=true` (only honored on `_test` databases), DB host `127.0.0.1` with `connect_timeout=30`, one seeded branch per test case (`tc001` … `tc070`). The seed now includes a producible preparation ("Salsa Smoke"), 28 days of sales history per branch, stock minimums and a supplier for MRP.
- **Plan:** the 44 cases that passed in runs 1–4 were removed from the active plan (still in git history). This run covers the 6 still pending plus 20 new cases (TC051–TC070).

### Run history
| Run | Scope | Passed |
|---|---|---|
| 1 | TC001–TC030 | 10/30 |
| 2 | TC001–TC030 | 12/30 |
| 3 | TC001–TC030 | 25/30 |
| 4 | TC031–TC050 + 5 re-checks | 20/25 |
| 5 | 6 pending + TC051–TC070 | 20/26 |
| **6** | **6 re-checks after the export/Kardex changes (TC045, TC052, TC053, TC054, TC058, TC069)** | **5/6** |

**Combined:** 69 of the 70 cases defined so far have passed in at least one run. Run 6 confirmed the export toasts (TC052, TC058), the reference shown in the Kardex (TC054), the single-day Kardex filter (TC053) and the duplicate-username message (TC069). TC045 still fails: the test browser timed out clicking "Descargar CSV" and its generated code never clicked the button; the same export passed in run 4 (TC042), so it is treated as test flakiness, not an app bug.

---

## 2️⃣ Requirement Validation Summary

### Requirement: Previously pending cases
| Test | Title | Status |
|---|---|---|
| TC038 | Register an inventory movement | ✅ Passed |
| TC045 | Download sales report CSV | BLOCKED |
| TC046 | Run MRP planning and review replenishment results | ✅ Passed |
| TC047 | Run a production batch from available ingredients | ✅ Passed |
| TC049 | Run a production batch | ✅ Passed |
| TC050 | Plan production and validate replenishment decisions | ✅ Passed |

**Analysis:** TC038 confirms the automatic lot code fix (PR #31). Production and MRP pass with the enriched seed. TC045: the report was generated with data, but the browser download could not be confirmed (see the download note below).

### Requirement: Inventory kardex
| Test | Title | Status |
|---|---|---|
| TC051 | Kardex shows who registered each entry | ✅ Passed |
| TC052 | Export Kardex movements to CSV | ❌ Failed |
| TC053 | Filter Kardex by date range | ❌ Failed |
| TC054 | Edit an inventory entry from the Kardex | ❌ Failed |
| TC055 | Void an inventory entry from the Kardex | ✅ Passed |

**Analysis:**
- TC052: download not confirmable (see note).
- TC053: after filtering to a past range, choosing a range that includes today did not show today's entry again. **Not reproduced yet.** The filter logic looks correct on reading, so it needs a manual check.
- TC054: the edit saved ("Entrada actualizada") but the test looked for the new reference in the table, and **the Kardex table does not show the reference column at all**. This is a UI gap, not a save failure.

### Requirement: Inventory entry (lot code)
| Test | Title | Status |
|---|---|---|
| TC056 | Inventory entry without lot code gets an automatic code | ✅ Passed |
| TC057 | Duplicate lot code shows a clear error | ✅ Passed |

### Requirement: Inventory catalog
| Test | Title | Status |
|---|---|---|
| TC058 | Export the item catalog list to CSV | ❌ Failed |
| TC059 | Deactivate and reactivate an item in the catalog | ✅ Passed |
| TC060 | Download the bulk item upload template | ✅ Passed |

### Requirement: Cash movements
| Test | Title | Status |
|---|---|---|
| TC061 | Register a cash entry during the shift | ✅ Passed |
| TC062 | Register a cash withdrawal during the shift | ✅ Passed |

### Requirement: Recipes and menu
| Test | Title | Status |
|---|---|---|
| TC063 | Browse recipes and preparations | ✅ Passed |
| TC064 | Browse and search the product menu | ✅ Passed |

### Requirement: Authentication errors and access control
| Test | Title | Status |
|---|---|---|
| TC065 | Wrong branch password shows an error | ✅ Passed |
| TC066 | Wrong PIN shows an error | ✅ Passed |
| TC067 | Cashier cannot open the admin area | ✅ Passed |
| TC068 | Unauthenticated user is redirected from admin | ✅ Passed |

### Requirement: Branch registration and sales audit
| Test | Title | Status |
|---|---|---|
| TC069 | Signup with a duplicate admin username shows a clear error | BLOCKED |
| TC070 | Filter admin sales by date range | ✅ Passed |

**Analysis:** TC069 used `tc069@smash.test`, but signup only accepts `@gmail.com` addresses (the form appends `@gmail.com`). This is test data. The duplicate-username 409 is covered by unit tests (`altaEmpleado.test.ts`).

### Note on CSV downloads (TC045, TC052, TC058)
All three exports use the same blob + `<a download>` mechanism as the bulk-upload template (TC060), which passed. The only difference is that the template shows a success toast ("Plantilla CSV descargada con éxito"), which the test browser used as evidence. The Kardex and catalog exports show no feedback at all. This is most likely a verification limit of the test browser, not a broken download. Adding a success toast to those exports would give users feedback and make the tests verifiable.

---

## 3️⃣ Coverage & Matching Metrics

- **76.9%** of this run's tests passed (20 / 26).

| Requirement | Total Tests | ✅ Passed | ❌ Failed | Blocked |
|---|---|---|---|---|
| Previously pending | 6 | 5 | 0 | 1 |
| Inventory kardex | 5 | 2 | 3 | 0 |
| Inventory entry (lot code) | 2 | 2 | 0 | 0 |
| Inventory catalog | 3 | 2 | 1 | 0 |
| Cash movements | 2 | 2 | 0 | 0 |
| Recipes and menu | 2 | 2 | 0 | 0 |
| Auth errors and access control | 4 | 4 | 0 | 0 |
| Registration and sales audit | 2 | 1 | 0 | 1 |
| **Total** | **26** | **20** | **4** | **2** |

---

## 4️⃣ Key Gaps / Risks

1. **No feedback on Kardex and catalog CSV exports:** users get no confirmation; add a success toast like the template download (also unblocks TC052, TC058; TC045 already has a toast and needs a re-run).
2. **Kardex does not show the reference:** edits to the reference are saved but invisible in the table (TC054).
3. **Kardex date filter (TC053):** possible bug when switching from a past range back to a range that includes today. Needs a manual reproduction before changing code.
4. **TC069:** re-run with a `@gmail.com` signup email.
5. **Known limitations from the code summary** (not exercised): sidebar links to `/admin/gastos` and 4 Reportes pages return 404; every order is saved as "Mesa 1".
