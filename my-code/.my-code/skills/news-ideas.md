---
name: news-ideas
description: When asked for ideas about a topic, search the web for the latest news and generate ideas based on recent events.
args: [topic]
allowed-tools: [WebSearch, WebFetch]
---

The user is asking for ideas about: {{topic}}

Before generating ideas, please:
1. Use the `WebSearch` tool to search for the latest news on this topic from the last 7 days.
2. If necessary, use `WebFetch` to read the top 1-3 most relevant articles.
3. Synthesize the recent news and use it as a foundation to brainstorm 5-10 bulleted ideas for the user.
4. Include a "News Snapshot" section summarizing the recent events you found.
5. Provide citations (Title + URL) for the news sources you used.
