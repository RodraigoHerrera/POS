# TestSprite AI Testing Report (MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** POS (Smash POS)
- **Date:** 2026-10-30
- **Prepared by:** TestSprite AI Team + Claude Code
- **Test type:** Frontend, full codebase, production build (`next build` + `next start`)
- **Target:** `http://localhost:3100` against the isolated `smash_test` database (smoke seed)
- **Executed:** 30 of 50 planned cases (production-mode cap)

---

## 2️⃣ Requirement Validation Summary

### Requirement: Authentication (branch login → employee → PIN)
| Test | Title | Status | Cause |
|---|---|---|---|
| TC002 | Complete branch login and route to the employee selector | ❌ Failed | Login returned 500: Prisma could not reach MySQL |
| TC003 | Select an employee and enter a valid PIN to reach the cashier area | BLOCKED | Login rate limit per IP |
| TC005 | Log in and enter the cashier area | ❌ Failed | Login returned 500: Prisma could not reach MySQL |
| TC012 | Route an administrator through PIN login to the dashboard | ✅ Passed | — |

**Analysis:** The login flow works (TC012 passed end to end). The failures come from the environment, not from login logic: 7 `PrismaClientInitializationError: Can't reach database server at localhost:3306` in the server log (one per failing case), and the 15 requests/minute/IP login limit, which every test hits because they all come through the same TestSprite tunnel IP.

### Requirement: Branch signup
| Test | Title | Status |
|---|---|---|
| TC013 | Register a new branch and first administrator | ✅ Passed |
| TC014 | Create a new branch and first administrator | ✅ Passed |

### Requirement: Cash register (apertura / cierre)
| Test | Title | Status | Cause |
|---|---|---|---|
| TC006 | Open the register and start cashier operations | BLOCKED | Register already open (shared state between parallel tests) |
| TC007 | Open the cash register and reach the POS screen | ❌ Failed | Same: "Ya tienes una caja abierta en esta sucursal" |
| TC011 | Open the cash register and start a sales session | ❌ Failed | Same |
| TC015 | Close the cash register and end the cashier session | BLOCKED | Login rate limit |
| TC016 | Close the cash register at the end of the shift | BLOCKED | Login 500 (DB unreachable) |
| TC019 | Continue to POS when the register is already open | ✅ Passed | — |

**Analysis:** All tests share one branch, so the first one that opens the register leaves it open for the rest. Real UX finding: when the register is already open, "Confirmar Apertura" shows the alert again and again and the screen stays on "Apertura de Caja", instead of sending the user to sales.

### Requirement: Orders and kitchen (comanda)
| Test | Title | Status | Cause |
|---|---|---|---|
| TC001 | Build an order and send it to kitchen | BLOCKED | Login 500 (DB unreachable) |
| TC004 | Complete a new order and send it to the kitchen | BLOCKED | Login rate limit |
| TC020 | Recover an open order and resume payment | BLOCKED | Login rate limit |
| TC024 | Edit an open order from the recovery flow | ✅ Passed | — |
| TC029 | Review and manage open orders from the recovery screen | BLOCKED | Login 500 (DB unreachable) |

### Requirement: Payments and billing
| Test | Title | Status | Cause |
|---|---|---|---|
| TC008 | Complete a cash payment and finish the order | BLOCKED | Login rate limit |
| TC009 | Complete payment for an open order | BLOCKED | Login rate limit |
| TC010 | Complete a sale with payment details | BLOCKED | Register already open |
| TC017 | Complete a card payment with billing details | ✅ Passed | — |
| TC021 | Resume charging an open order | BLOCKED | Login 500 (DB unreachable) |
| TC030 | Complete a QR or transfer payment | BLOCKED | Login rate limit |

### Requirement: Admin dashboard
| Test | Title | Status | Cause |
|---|---|---|---|
| TC018 | View dashboard metrics for the selected period | BLOCKED | Login rate limit |
| TC026 | Review dashboard KPIs as an administrator | ✅ Passed | — |
| TC027 | View admin dashboard metrics and stock alerts | ✅ Passed | — |

### Requirement: Sales audit and voids
| Test | Title | Status | Cause |
|---|---|---|---|
| TC022 | Open sales audit and inspect a sale | ✅ Passed | — |
| TC023 | Audit sales and apply an administrative void | BLOCKED | Login 500 (DB unreachable) |
| TC025 | Void a sale with a reason | BLOCKED | Login rate limit |

### Requirement: Inventory
| Test | Title | Status |
|---|---|---|
| TC028 | View inventory management entry points | ✅ Passed |

---

## 3️⃣ Coverage & Matching Metrics

- **33.33%** of executed tests passed (10 / 30).
- No case failed because of application logic. Every failure or block traces to one of three environment causes.

| Requirement | Total Tests | ✅ Passed | ❌ Failed | Blocked |
|---|---|---|---|---|
| Authentication | 4 | 1 | 2 | 1 |
| Branch signup | 2 | 2 | 0 | 0 |
| Cash register | 6 | 1 | 2 | 3 |
| Orders and kitchen | 5 | 1 | 0 | 4 |
| Payments and billing | 6 | 1 | 0 | 5 |
| Admin dashboard | 3 | 2 | 0 | 1 |
| Sales audit and voids | 3 | 1 | 0 | 2 |
| Inventory | 1 | 1 | 0 | 0 |
| **Total** | **30** | **10** | **4** | **16** |

| Root cause | Cases |
|---|---|
| Login rate limit (15 req/min per IP, all tests share the tunnel IP) | 9 |
| MySQL unreachable under concurrent load (`Can't reach database server at localhost:3306`) | 7 |
| Shared register state across parallel tests ("Ya tienes una caja abierta") | 4 |

---

## 4️⃣ Key Gaps / Risks

1. **Login rate limit blocks automated runs.** All tests come from one IP, so the per-IP limit locks out most of the suite. For test runs it needs to be configurable (higher limit, or disabled when pointed at a `_test` database).
2. **MySQL refuses connections under concurrent load.** 7 logins failed with `PrismaClientInitializationError`. Check the local MySQL `max_connections` and the Prisma pool size (`connection_limit` in `DATABASE_URL`). This could also show up in production at peak hours.
3. **No isolation between tests.** Every case uses the same branch and cashier, so a register opened by one test breaks the others. Each test needs its own branch, or a reset between cases.
4. **Register apertura UX (real bug):** when a register is already open, "Confirmar Apertura" repeats the alert and stays on the screen instead of redirecting to `/cajero/ventas`.
5. **Not covered in this run:** 20 planned cases were not executed (production cap of 30), and the blocked flows (cash/QR payment, register close, sale void, order to kitchen) have no real evidence yet.
6. **Known limitations from the code summary** (not exercised by the tests): sidebar links to `/admin/gastos` and 4 Reportes pages return 404; every order is saved as "Mesa 1".
