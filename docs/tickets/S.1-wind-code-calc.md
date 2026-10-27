# S.1 — ★ Wind code calc (stretch)

- **Track:** A (Hamid)
- **Phase:** stretch, only if ahead of schedule
- **Type:** **HITL**. The numbers must be checked against a hand calc.
- **Blocked by:** A5.1

## What to build

- **Goal:** calculate `windPlf.X` and `windPlf.Y` from ASCE 7-22 Chapter 27 (directional procedure, MWFRS) for a low-rise building, then write them into the Load form inputs.
- **Inputs:** V, exposure, K_d, K_zt, K_e, G = 0.85, mean roof height, and plan dimensions (from the outline's bounding box).
- **Calculation:**
  - q_h at mean roof height
  - windward pressure plus leeward pressure, with C_p from L/B
  - times the tributary height of the top Story → plf
- **Minimum:** check the result against the minimum design wind load.
- **Primary source first:** research §2.9 marks the Ch. 27/28 details and the minimums as **UNVERIFIED**. Confirm the coefficients against the ASCE 7-22 text before trusting the numbers.

## Acceptance criteria

- [ ] For one hand-calculated example, the app's plf matches within 1%
- [ ] The inputs and results show in a "Wind" section of the Code calc tab
