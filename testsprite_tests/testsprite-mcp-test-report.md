# TestSprite AI Testing Report (MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** POS (Smash POS)
- **Date:** 2026-10-30
- **Prepared by:** TestSprite AI Team + Claude Code
- **Test type:** Frontend, full codebase, production build (`next build` + `next start`)
- **Target:** `http://localhost:3100` against the isolated `smash_test` database
- **Environment:** `RATE_LIMIT_RELAXED=true` (only honored on `_test` databases), DB host `127.0.0.1` with `connect_timeout=30`, one seeded branch per test case (`tc001@smash.test` … `tc030@smash.test`)
- **Executed:** 30 of 50 planned cases (production-mode cap)

### Run history
| Run | Passed | Failed | Blocked | Main causes |
|---|---|---|---|---|
| 1 | 10 | 4 | 16 | Login rate limit (9), Prisma connect timeout (7), shared register (4) |
| 2 | 12 | 3 | 15 | Tests could not map their TC number to a branch (11), shared register (5) |
| **3 (this report)** | **25** | **2** | **3** | Register opening loop (3), test data (1), test identity (1) |

---

## 2️⃣ Requirement Validation Summary

### Requirement: Authentication (branch login → employee → PIN)
| Test | Title | Status |
|---|---|---|
| TC002 | Complete branch login and route to the employee selector | ✅ Passed |
| TC003 | Select an employee and enter a valid PIN to reach the cashier area | ✅ Passed |
| TC005 | Log in and enter the cashier area | ✅ Passed |
| TC012 | Route an administrator through PIN login to the dashboard | ✅ Passed |

### Requirement: Branch signup
| Test | Title | Status |
|---|---|---|
| TC013 | Register a new branch and first administrator | ✅ Passed |
| TC014 | Create a new branch and first administrator | ✅ Passed |

**Analysis:** Passes with unique usernames. Run 2 showed that a duplicate admin username makes `POST /api/auth/registerAdmin` return 500 (`P2002 empleados_usuario_key`) instead of a clear validation message.

### Requirement: Cash register (apertura / cierre)
| Test | Title | Status |
|---|---|---|
| TC006 | Open the register and start cashier operations | ❌ Failed |
| TC007 | Open the cash register and reach the POS screen | ❌ Failed |
| TC011 | Open the cash register and start a sales session | ✅ Passed |
| TC015 | Close the cash register and end the cashier session | BLOCKED |
| TC016 | Close the cash register at the end of the shift | ✅ Passed |
| TC019 | Continue to POS when the register is already open | ✅ Passed |

**Analysis:** Each failing case had its own fresh branch, so this is no longer shared state. After "Confirmar Apertura" the page stays on "Apertura de Caja" and every further click returns 409 "Ya tienes una caja abierta en esta sucursal". The server logged no errors, so the register was created and the loop is client-side: `src/app/(usuario)/cajero/page.tsx` treats the 409 as an error (alert) instead of continuing to `/cajero/ventas`. Intermittent (TC011, TC016, TC019 passed).

### Requirement: Orders and kitchen (comanda)
| Test | Title | Status |
|---|---|---|
| TC001 | Build an order and send it to kitchen | ✅ Passed |
| TC004 | Complete a new order and send it to the kitchen | ✅ Passed |
| TC020 | Recover an open order and resume payment | ✅ Passed |
| TC024 | Edit an open order from the recovery flow | ✅ Passed |
| TC029 | Review and manage open orders from the recovery screen | ✅ Passed |

### Requirement: Payments and billing
| Test | Title | Status |
|---|---|---|
| TC008 | Complete a cash payment and finish the order | ✅ Passed |
| TC009 | Complete payment for an open order | BLOCKED |
| TC010 | Complete a sale with payment details | ✅ Passed |
| TC017 | Complete a card payment with billing details | ✅ Passed |
| TC021 | Resume charging an open order | BLOCKED |
| TC030 | Complete a QR or transfer payment | ✅ Passed |

**Analysis:** TC009 had no open order to resume (test data; the new order was charged successfully). TC021 did not find its title in the credentials table even though it was listed (test-agent issue).

### Requirement: Admin dashboard
| Test | Title | Status |
|---|---|---|
| TC018 | View dashboard metrics for the selected period | ✅ Passed |
| TC026 | Review dashboard KPIs as an administrator | ✅ Passed |
| TC027 | View admin dashboard metrics and stock alerts | ✅ Passed |

### Requirement: Sales audit and voids
| Test | Title | Status |
|---|---|---|
| TC022 | Open sales audit and inspect a sale | ✅ Passed |
| TC023 | Audit sales and apply an administrative void | ✅ Passed |
| TC025 | Void a sale with a reason | ✅ Passed |

### Requirement: Inventory
| Test | Title | Status |
|---|---|---|
| TC028 | View inventory management entry points | ✅ Passed |

---

## 3️⃣ Coverage & Matching Metrics

- **83.33%** of executed tests passed (25 / 30).
- Environment causes from run 1 are gone: 0 rate-limit blocks, 0 `Can't reach database server` errors in the server log.

| Requirement | Total Tests | ✅ Passed | ❌ Failed | Blocked |
|---|---|---|---|---|
| Authentication | 4 | 4 | 0 | 0 |
| Branch signup | 2 | 2 | 0 | 0 |
| Cash register | 6 | 3 | 2 | 1 |
| Orders and kitchen | 5 | 5 | 0 | 0 |
| Payments and billing | 6 | 4 | 0 | 2 |
| Admin dashboard | 3 | 3 | 0 | 0 |
| Sales audit and voids | 3 | 3 | 0 | 0 |
| Inventory | 1 | 1 | 0 | 0 |
| **Total** | **30** | **25** | **2** | **3** |

---

## 4️⃣ Key Gaps / Risks

1. **Register opening loop (app bug, intermittent):** after a successful opening the cashier can end up on "Apertura de Caja", and every retry shows "Ya tienes una caja abierta". A 409 from `/api/caja/apertura` should send the user to `/cajero/ventas` instead of alerting. Affects TC006, TC007, TC015.
2. **JWT written to production logs (security):** `src/app/api/caja/apertura/route.ts` runs `console.log("Token generado:", cajaToken)`. Anyone with log access can reuse a register session token.
3. **Signup returns 500 on a duplicate admin username:** `POST /api/auth/registerAdmin` should return a 409 with a clear message on `P2002`.
4. **Not covered:** 20 planned cases were not executed (production cap of 30). TC009 and TC021 still lack evidence.
5. **Known limitations from the code summary** (not exercised): sidebar links to `/admin/gastos` and 4 Reportes pages return 404; every order is saved as "Mesa 1".
