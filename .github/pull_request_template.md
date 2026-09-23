## Summary

What changed and why.

## Validation

- [ ] `cd backend && make lint test`
- [ ] `cd frontend && npm run lint && npm run typecheck && npm run coverage`
- [ ] Tried it in the browser (mock mode is enough unless the Jev integration changed)

## Checklist

- [ ] No secrets, `.env` files or TypeSafe keys in the diff or logs
- [ ] Jev results are never faked in real mode; the mock stays behind `JEV_MODE=mock`
- [ ] README updated for user-visible changes
