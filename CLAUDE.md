# AI Assistant Instructions & Project Guidelines (FIT@HCMUS - Seminar Track)

* **Course:** Software Testing (CS423 / CSC15003) – FIT@HCMUS
* **Topic:** T05 - Performance Testing (Group 07)
* **Student:** Trương Thành Phát (23120319) – Technical & AI Lead
* **SUT:** EShop (Node.js + SQLite backend running at `http://localhost:3000`)
* **Primary Tool:** Grafana k6 (Local Windows CLI: `k6 run <script.js>`)

---

## MANDATORY RULE: AUTOMATIC AI AUDIT LOGGING

Academic integrity and the Seminar Track require a complete, verbatim AI Audit Log for every AI-assisted artifact.

### After generating or significantly modifying ANY artifact:
Artifacts include: k6 scripts (`ai_generated_raw.js`, `ai_audited_refined.js`, `smoke_test.js`, `baseline_load.js`, `spike_test.js`, `endurance_test.js`, `bakeoff_runner.js`), test data (`users.csv`), worksheets, or documentation sections.

The AI assistant **MUST AUTOMATICALLY execute** the following command using terminal/bash tools to log the artifact into `audit/audit-log.jsonl`:

```bash
python .claude/skills/ai-audit-log/scripts/audit.py add \
  --id "<A01, A02, A03, ...>" \
  --step "<Milestone / Task description>" \
  --tool "<AI Model Name (e.g. Claude 3.7 Sonnet, ChatGPT 4o)>" \
  --prompt "<Verbatim prompt from the user>" \
  --output-file "<Path to the generated file or output text>" \
  --verdict "<VALID | INVALID | INCOMPLETE>" \
  --reason "<Detailed technical reason citing API spec, SQLite constraints, or course rubric>" \
  --fix "<Concrete fix applied or file where the fix resides>"
```

### Honesty & Verdict Guidelines:
- **`VALID`**: Output was tested, matches the API spec, and executed with 0 errors.
- **`INVALID`**: Output had factual errors, broken endpoints, or failed test checkpoints.
- **`INCOMPLETE`**: Output missed edge cases, lacked data-driven isolation, had silent assumptions, or required human remediation.
- Never label an unverified artifact as `VALID`.

### Rendering the Final Report:
When requested to export or build the audit report, run:
```bash
python .claude/skills/ai-audit-log/scripts/audit.py build \
  --name "TRUONG THANH PHAT" \
  --mssv "23120319" \
  --cls "Seminar Nhom 07" \
  --hw "Seminar-T05 Performance Testing" \
  --out "report/appendix-A-ai-audit.vi.md"
```

---

## Technical Conventions for EShop k6 Testing
1. **Base URL:** `http://localhost:3000` (Native k6 CLI).
2. **API Payload Contracts:**
   - `POST /api/login`: `{ email, password }` -> Returns `{ token, user }`.
   - `POST /api/apply-coupon`: `{ code, total_amount, user_id }` (Required snake_case).
   - `POST /api/checkout`: `{ total_amount, shipping_address }` (Required snake_case).
   - `POST /api/cart`: `{ id, name, price, quantity }`.
3. **Data-driven Isolation:** Always use `users.csv` via `SharedArray` to assign unique credentials per Virtual User (VU) to avoid SQLite lock contention and coupon limit conflicts.
4. **Think Time:** Always include realistic jittered think time (e.g., `sleep(Math.random() * 2 + 1)`).
