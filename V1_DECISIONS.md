## 9) Open Questions / Ambiguities to Resolve Before Build Lock

1. Should Phase 1 graph implementation be Azure SQL Graph immediately, or relational-only with graph migration later? Azure SQL Graph immediately 
2. For “same format” Excel export, do you require style/formula fidelity or column/layout fidelity only? style/formulacolumn/layout fidelity, plus columns that are part of the comparision.
3. Should 7-year retention apply to audit metadata/results only, while raw uploaded engineering files still delete at day 7? Yes.
4. Confirm default multi-version behavior: each new upload compares against the immediately previous revision in-session. Yes, initially 2 files are required to be uploaded, but after the initial comparision has happend there is a posibility that the user adds a new file to the same comparision.
5. Confirm upload policy for onboarding: strict 48h from first use vs initial credit-based grace period.  First 3 comparisons unrestricted, then 48h rule.
6. Confirm launch notification default: in-app only or in-app + email.
in-app for V1 and in-app + email for v2.
---

8) Decisions you need to make now (product owner controls)

1. **V1 file formats**
   - A) CSV/Excel only (fast launch)
   - We are going to go with Option A. We will limit V1 file formats to CSV/Excel.

2. **Notification in V1**
   - A) In-app only, In-app only notifications

3. **Upload limit onboarding policy**
   - B) first 3 comparisons unrestricted, then 48h rule. 
   - first 3 comparisons unrestricted, then 48h rule for V1

4. **Sharing scope in V1**
   - A) single recipient per share, single recipient per share for V1.

5. **Deployment preference**
   - The intention is to deploy this in Azure, so use technologies that are in Azure, and I want more control for V1.