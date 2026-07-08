---
name: draft-email
description: Draft an email in a formal “From/To/Date/Subject” letter style format.
arguments: [from, to, date, subject, recipientName, body, closingName]
---

Draft a professional email using *exactly* the following structure and ordering (include the labels and punctuation exactly as shown):

From: {{from}}
To: {{to}}
Date: {{date}}
Subject: {{subject}}

Dear {{recipientName}},

{{body}}

I remain,

Your most obedient and humble servant,
{{closingName}}

Rules:
- Output ONLY the email text in the specified format (no commentary, no markdown fences).
- Keep the tone formal and courteous (Victorian/letter-like, similar to the example).
- Ensure blank lines match the template: one blank line after Subject, one blank line after greeting, one blank line before “I remain,” and one blank line between “I remain,” and the sign-off line.
- If the user provides missing details, infer minimally and keep it plausible; do not invent sensitive personal data.
