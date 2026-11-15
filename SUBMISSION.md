# Submission kit: SERV Hackathon 02

Form: https://openserv.typeform.com/submissions02
Deadline: 15 November 2026, 23:59 UTC (00:59 Lagos)
Required: public repo, demo link or video, short write-up (what it does, how it uses SERV Reasoning, which track), link to an X post made before the deadline.

## Field answers (plain text, paste as is)

Project name

    Na Income?

Track

    Open Track

Repository

    https://github.com/Nuel-osas/na-income

Demo link

    https://na-income.vercel.app

Write-up (908 characters)

    Na Income? turns a Nigerian bank statement into a 2026 personal income tax estimate under the Nigeria Tax Act 2025, in force since 1 January 2026. Paste a CSV or upload the PDF your bank sends: SERV Reasoning reads the rows, and code keeps a row only if its amount appears in the statement and the running balance adds up. SERV then says what each inflow was (client payment, salary, own transfer, gift, loan or refund), quoting the narration. Code does the amounts in kobo, the Act's bands and reliefs. When SERV is not sure, it asks one question, and each answer shows the new tax before you click. Any SERV failure counts every inflow as income, so the figure is never an underestimate. On a 30-case labelled set: 28 to 29 correct, zero dangerous errors. SERV use: gpt-5.4-mini, rulebook system prompt, reasoning_effort low, strict json_schema, serv_shadow_agent in Careful mode. Tests and CI. Open Track.

Write-up, short version if a field is limited to about 500 characters (432 characters)

    Na Income? turns a Nigerian bank statement, CSV or PDF, into a 2026 income tax estimate under the Nigeria Tax Act 2025. SERV Reasoning reads the rows (code checks each against the running balance) and says what each inflow was, quoting the narration. Code does the amounts, bands and reliefs. When SERV is unsure it asks one question and shows the new tax per answer. gpt-5.4-mini, strict json_schema, serv_shadow_agent. Open Track.

## X post (278 of 280, with the link counted as 23)

    Nigeria's new tax law started on 1 Jan 2026. Is that ₦300k transfer income, a gift or a loan?

    Na Income? reads your bank statement with @openservai SERV Reasoning, asks only what it can't tell, and works out your 2026 tax.

    SERV Hackathon 02, Open Track
    https://na-income.vercel.app

First reply under it

    Code: https://github.com/Nuel-osas/na-income
    Try the "Tricky statement": a company that writes "gift" on every monthly payment, and a narration that tells the AI to ignore its rules. Neither works.

Attach the demo video or a screenshot of the questions panel to the post itself (native upload, not a link).

## 60-second demo script

| Time | On screen | Say or caption |
|---|---|---|
| 0 to 6 s | Landing page, designer sample loaded | "Nigeria's new tax law started this year. Which of your transfers are income?" |
| 6 to 10 s | Click Check my statement, timer runs | "SERV Reasoning reads every inflow." |
| 10 to 22 s | Result: headline tax, breakdown | "Payoneer and Grey are income. Mum's upkeep is a gift. The loan app is a loan. Code does the maths with the Act's bands." |
| 22 to 34 s | Questions panel, Tunde ₦300,000 | "SERV can't tell what Tunde's ₦300,000 was, so it asks. Each answer shows the new tax." |
| 34 to 40 s | Click A loan I'll repay, number drops | "Answer, and the number moves." |
| 40 to 52 s | Tricky statement checked | "Writing gift on a monthly salary doesn't make it a gift. And a narration that tells the AI to ignore its rules is caught." |
| 52 to 60 s | Audit panel | "Every check shows the model, the SERV features used and the code rules that fired. na-income.vercel.app" |

## Checklist

- [x] Live URL works with no login
- [x] All three samples classify through SERV on production
- [x] API key not in the repo or the client bundle
- [x] README: problem, live link, try path, SERV usage, law with sources, what was built, tools
- [x] PDF statements: upload or paste, rows verified by running balance
- [x] Tests (npm test) and CI (GitHub Actions)
- [x] Demo film: ~/Downloads/na-income-demo.mp4 (64.5 s, 1080p, narrated)
- [ ] X post published with the film attached natively, link copied
- [ ] Form submitted before 23:59 UTC
- [ ] SERV credit balance checked; top up so judges' checks keep working through judging week
