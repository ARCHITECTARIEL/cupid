---
title: Cupid Game
emoji: 💘
colorFrom: pink
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# Cupid Game

Hugging Face Docker Space for the date-night arcade reward game.

Routes:

- `/` game
- `/dashboard` private admin dashboard
- `/redeem/:code` reward wallet

Set `ADMIN_PIN` in Hugging Face Space secrets to lock the dashboard.
