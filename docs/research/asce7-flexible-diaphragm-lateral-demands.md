# ASCE 7 lateral demands for a flexible-diaphragm plan app

> **Purpose:** Code research for the Hackathon 2026 app described in `problem.md`.
> **Researched:** 2026-10-27.
> **Scope:** seismic ELF, the diaphragm force F_px, flexible-diaphragm distribution, chords, collectors, ρ and Ω₀, multi-story vertical distribution, a short wind section, and the USGS ground-motion API.
> **Citation format:** `[S#, p. N]` points to the numbered list in section 6. Page numbers are the printed page numbers of the source.
> **UNVERIFIED** means I could not read the ASCE 7 text (it is paywalled) and no free primary source in hand reproduces that exact provision. Treat those items as "probably right, confirm with someone who has ASCE 7-22 open."

---

## 1. TL;DR

1. **Use ASCE 7-22 (the edition referenced by the 2024 IBC) with the Equivalent Lateral Force (ELF) procedure.** The ELF equations barely changed from 7-16. The real 7-16 to 7-22 difference is how you get S_DS and S_D1, so if the user types S_DS and S_D1 in, the app works for either edition. [S1, p. 33; S8, p. 1]
2. **The app needs two force levels, not one:**
   - **LFRS lines** (shear walls, braced frames) get the base-shear-level force, V = C_s·W, times ρ.
   - **Diaphragm, chords, and collectors** get F_px = max(C_s·w_px, 0.2·S_DS·I_e·w_px), capped at 0.4·S_DS·I_e·w_px, with ρ = 1.0.

   For a one-story wood shear-wall building (R = 6.5), the 0.2 minimum governs, so the diaphragm force is about 1.3 times the base-shear-level force. Show both levels. [S1, pp. 268–269; S2, p. 20]
3. **Flexible diaphragm means tributary area and simple spans.** Each span between two adjacent resisting lines is a simply supported beam with a "hinge" at interior lines:
   - Reaction: R = wL/2
   - Unit shear: v = R/d
   - Moment: M = wL²/8
   - Chord force: T = C = M/d

   No accidental torsion is applied. [S2, pp. 5, 15, 25; S3, §4.1.7.1, p. 17]
4. **Collectors run the full length of each line.** The collector force at a point is (diaphragm unit shear coming in) × (distance) minus (wall unit shear going out) × (wall length passed). The peak is v_in × (the longest collector length beyond the wall). [S2, pp. 9, 22]
5. **Ω₀ on collectors is a toggle.**
   - Required in SDC C–F.
   - Not applied to inertial F_px forces in SDC B.
   - Not required for structures braced entirely by light-frame (wood) shear walls.

   Default it by the system type and let the user override. [S2, p. 22; S1, p. 255]
6. **Report strength-level E and ASD (0.7E) side by side.** ρ is a user input (1.0 or 1.3) for the LFRS lines and is fixed at 1.0 for the diaphragm. [S1, pp. 66, 247, 269]
7. **Multi-story (phase 2):**
   - F_x = C_vx·V with k = 1. All low-rise buildings have T ≤ 0.5 s.
   - Story shear: V_x = Σ F_i over the levels above.
   - Each level gets its own F_px from Eq. 12.10-1 with the 0.2 and 0.4 bounds.
   - Require the lines to stack (same layout at every level), so there are no transfer forces.

   [S1, pp. 274–277]
8. **Wind: don't do a code wind calculation in the hackathon.** ASCE 7-22 deleted the simplified wind methods (in Ch. 27, 28, and 30). Support wind through a **direct-force mode** where the user types the force. [S8, p. 9]
9. **USGS lookup is easy and free:**
   - Request: `GET https://earthquake.usgs.gov/ws/building-codes/asce7-22/calculate?latitude=..&longitude=..&riskCategory=II&siteClass=D&title=x`
   - Response includes `sds`, `sd1`, `s1`, `sdc`, and `tl`.
   - No API key needed, and CORS is `*`, so a browser can call it directly.

   I verified it live on 2026-10-27. Make it an optional "look up" button. Manual entry stays the main path. [S5; S4]
10. **Biggest gaps to confirm with the ASCE 7-22 text:**
    - exact wording of the §12.10.2.1 exceptions
    - §12.3.1.1 (flexible diaphragm conditions)
    - §12.7.2 (seismic weight components)
    - §12.3.4 (ρ conditions)
    - §12.8.4.2 (accidental torsion wording)

    See the UNVERIFIED flags below.

---

## 2. Findings

### 2.1 Seismic base shear, ELF (Q1)

**Equations (ASCE 7-22 §12.8.1, §12.8.2):**

| Item | Formula | Source |
|---|---|---|
| Base shear | V = C_s·W (Eq. 12.8-1) | [S1, pp. 191, 268] |
| C_s | C_s = S_DS / (R/I_e) (Eq. 12.8-2) | [S1, p. 191] |
| Upper limit, T ≤ T_L | C_s ≤ S_D1 / (T·(R/I_e)) (Eq. 12.8-3) | [S1, pp. 191, 268] |
| Upper limit, T > T_L | C_s ≤ S_D1·T_L / (T²·(R/I_e)) | Spectrum shape S_a = S_D1·T_L/T² in [S2, p. 17, Fig. 4-5]. Exact 7-22 eq. text **UNVERIFIED**. Never governs for low-rise. |
| Lower limit | C_s ≥ 0.044·S_DS·I_e ≥ 0.01 (Eq. 12.8-5) | [S1, pp. 148, 191] |
| Extra lower limit where S1 ≥ 0.6g | C_s ≥ 0.5·S1 / (R/I_e) (Eq. 12.8-6) | [S1, pp. 148, 191] |
| Approximate period | T_a = C_t·h_n^x. C_t = 0.020, x = 0.75 for "all other structural systems" (wood shear walls, most braced frames). | [S1, pp. 191, 267] |
| Period cap | T ≤ C_u·T_a. C_u = 1.4 for S_D1 ≥ 0.4. | [S1, pp. 147, 191] |

Notes:

- **Equation numbers.** FEMA P-2192 Ch. 5 numbers these 12.8-1 through 12.8-6 and gives T_a as 12.8-7. Ch. 7 of the same document labels C_s = S_DS/(R/I_e) as "12.8-3" and T_a as "12.8-8" [S1, pp. 267–268]. The 7-22 equation numbering is therefore **UNVERIFIED**. **Cite section numbers in the app, not equation numbers.**
- **Using T = T_a directly** is how the FEMA one-story wood example does it (T_a = 0.02·25^0.75 = 0.22 s) [S1, p. 267]. Recommend the app always uses T = T_a, so no C_u logic is needed.
  - Other C_t / x pairs (steel moment frame 0.028/0.8, concrete moment frame 0.016/0.9, steel EBF/BRBF 0.03/0.75) and the full C_u table: **UNVERIFIED** (from memory of Tables 12.8-1 and 12.8-2).
- **Short-period buildings.** For short-period low-rise buildings, C_s = S_DS·I_e/R governs. In the FEMA assembly-hall example, C_s = 1.0/(6.5/1.25) = 0.192, and the S_D1 limit of 0.524 does not govern [S1, pp. 267–268].
- **Inputs the app needs:**
  - S_DS and S_D1 (§11.4.4) [S1, p. 266]
  - S1 (only for Eq. 12.8-6 and for SDC)
  - T_L (only if T > T_L, which never happens here; USGS returns `tl`)
  - R, Ω₀, C_d from Table 12.2-1
  - I_e from Table 1.5-2
  - h_n
  - the system type (for C_t and x)
  - W (§12.7.2)
- **Typical values.** For wood structural panel (WSP) shear walls in ASCE 7-22: R = 6.5, Ω₀ = 3, C_d = 4 [S1, p. 266]. I_e = 1.25 for Risk Category III [S1, p. 266]. I_e = 1.0 for RC I/II and 1.5 for RC IV: **UNVERIFIED**.
- **§12.8.1.3** (cap on S_DS used for C_s in short regular buildings) exists in 7-16. Its 7-22 content is **UNVERIFIED**. Recommend: do not implement.

**ASCE 7-16 vs 7-22 differences that matter to this app:**

- **Ground motions (the big one).**
  - 7-22 uses multi-period response spectra and adds Site Classes BC, CD, and DE. The default site class is now the envelope of C, CD, and D [S1, p. 33].
  - The F_a / F_v site-coefficient tables are gone. S_DS = ⅔·S_MS and S_D1 = ⅔·S_M1 come straight from the USGS service for the chosen site class [S1, pp. 95, 99, 103].
  - 7-16 §11.4.8 required a site-specific analysis for Site Class D with S1 ≥ 0.2g (and Site Class E with S_s ≥ 1.0g). Its exception lets you use a 50% increase in S_M1 (and S_D1) instead [S1, pp. 102–103]. 7-22 removes this need [S1, p. 99].
  - The USGS 7-16 service returns `sd1: null` in that case (see 2.10).
- **ELF.** "Chapter 12 and Chapter 15 provisions continue to be framed in terms of … S_DS and S_D1, and only minor changes are required in the Equivalent Lateral Force Procedure" [S1, p. 33].
- **Diaphragms.** 7-22 expands the §12.10.3 alternative and adds a new §12.10.4 for one-story rigid-wall / flexible-diaphragm buildings [S1, p. 247]. See 2.3.
- **Drift.** In 7-22, diaphragm deflection may be neglected when computing design story drift for the §12.12.1 check [S1, p. 251].
- **Code adoption.** ASCE 7-22 is the reference standard for the 2024 IBC [S8, p. 1]. The 2021 IBC references ASCE 7-16: **UNVERIFIED** here, but standard knowledge.

### 2.2 Vertical distribution and story shear (multi-story, phase 2)

- **Vertical distribution** (ASCE 7-22 §12.8.3) [S1, p. 274; also p. 192]:
  - F_x = C_vx·V (Eq. 12.8-11)
  - C_vx = w_x·h_x^k / Σ_{i=1..n} w_i·h_i^k (Eq. 12.8-12)
  - h is measured from the base.
  - k = 1 for T ≤ 0.5 s, k = 2 for T ≥ 2.5 s. In between, use k = 2 or interpolate linearly between 1 and 2.
- **Story shear:** V_x = Σ_{i=x..n} F_i, the sum of the level forces at and above level x. FEMA P-2192 Table 7-7 tabulates this as "Σ F_i = V_i" [S1, p. 276]. This is §12.8.4. The exact §12.8.4 wording about distribution "based on relative stiffness … and the diaphragm" is **UNVERIFIED**.
- **Flexible diaphragms:** each level's force goes to the vertical elements of the story below by tributary area [S3, §4.1.7.1, p. 17]. With stacked lines, a line's demand in story x is the sum over all levels i ≥ x of (F_i × that line's tributary fraction at level i).
- **F_x vs F_px.** These are two different sets of forces:
  - F_x is used to design the vertical elements.
  - F_px is used to design each diaphragm. F_px reflects each floor's peak acceleration, and floors don't all peak at the same moment [S2, pp. 17–18, Fig. 4-6].
  - "F_px forces are always equal to or greater than F_x forces" [S2, p. 20]. FEMA P-2192: "Diaphragm design force is given by the larger of F_x … and F_px" [S1, p. 275].
- **Transfer forces** happen when lines don't stack or wall stiffness changes between stories. They need §12.10.1.1, use the calculated ρ (not 1.0), and in some cases need Ω₀ [S2, p. 20; S1, p. 255]. **Out of scope:** require stacked lines.

### 2.3 Diaphragm design force F_px (Q2)

ASCE 7-22 §12.10.1.1 [S1, pp. 254–255; S2, p. 20]:

- **Eq. 12.10-1:** F_px = ( Σ_{i=x..n} F_i / Σ_{i=x..n} w_i ) · w_px
- **Eq. 12.10-2 (minimum):** F_px ≥ 0.2·S_DS·I_e·w_px. FEMA P-2192 phrases it as "not less than F_x or 0.2·S_DS·I_e·w_px" [S1, p. 255].
- **Eq. 12.10-3 (maximum):** F_px need not exceed 0.4·S_DS·I_e·w_px
- **w_px** is the weight tributary to the diaphragm at level x. It equals w_x, except that walls parallel to the force direction may be excluded. Including or excluding them is "at the discretion of the design engineer" [S1, p. 253].
- **ρ = 1.0** for diaphragm design forces [S1, pp. 247, 275; S2, p. 20].
- **ASD diaphragm force:** 0.7·F_px [S1, p. 269].

**Which force does a single-story flexible diaphragm use?** The diaphragm, its chords, and its collectors use **F_px**, not V. For one story, Eq. 12.10-1 reduces to F_px = C_s·w_px [S1, p. 268]. So:

> **F_px = min( max( C_s, 0.2·S_DS·I_e ) , 0.4·S_DS·I_e ) · w_px**, with ρ = 1.0.

Since C_s = S_DS·I_e/R, the 0.2 minimum governs whenever R > 5. That covers all wood light-frame shear wall systems (R = 6.5) [S2, p. 20]. FEMA's one-story wood assembly hall example (ASCE 7-22) shows this:

| Step | Value |
|---|---|
| C_s·w_px | 0.192 × 76,288 = 14,647 lb |
| Minimum, 0.2·S_DS·I_e·w_px | 19,072 lb (**governs**) |
| Maximum | 38,144 lb |
| ASD | 13,350 lb |

[S1, pp. 268–269]

The **shear walls** (vertical elements) are still designed for V = C_s·W (with ρ), distributed by tributary area. Fig. 4-6 of [S2] shows both sets of forces side by side [S2, pp. 17–18].

**ASCE 7-22 alternative diaphragm provisions** (both optional for wood structural panels; recommend **not implementing** either):

- **§12.10.3, alternative design provisions** [S1, pp. 250–252, 256–257, 269–271]
  - Uses F_px = C_px·w_px/R_s, with R_s = 3.0 for wood-sheathed diaphragms.
  - Required only for precast concrete diaphragms in SDC C–F. Optional for other diaphragm types.
  - Still has a 0.2·S_DS·I_e·w_px minimum. For the one-story wood example it gives the same governing 19,072 lb.
- **§12.10.4, alternative for one-story flexible-diaphragm, rigid-vertical-element (RWFD) buildings** [S1, pp. 251–252]
  - Applies to wood structural panel or bare steel deck diaphragms with rigid vertical elements (e.g., concrete tilt-up or masonry walls).
  - Mainly intended for diaphragm spans of 100 ft or more.
  - Collector forces are amplified by 1.5 instead of Ω₀.
- Both are beyond hackathon scope.

### 2.4 Flexible diaphragm definition, torsion, tributary distribution (Q3)

**Prescriptive flexible (§12.3.1.1).** As paraphrased by NEHRP Tech Brief 10 (ASCE 7-10 basis), wood structural panel diaphragms may be idealized as flexible in any of these cases [S2, p. 15]:

- (a) the vertical elements are steel braced frames, composite braced frames, or concrete, masonry, steel, or composite shear walls;
- (b) one- and two-family dwellings;
- (c) light-frame construction where the diaphragm is untopped (or has ≤ 1½ in. of nonstructural topping), and each line of vertical elements meets the allowable story drift.

The ASCE 7 text also covers untopped steel deck. Tech Brief 10 covers only wood. The exact 7-22 wording is **UNVERIFIED**, but FEMA P-2192 confirms that 7-22 §12.3 still has "idealized as flexible", "idealized as rigid", and "calculated as flexible" criteria, with semi-rigid as the fallback [S1, p. 253].

**Calculated flexible (§12.3.1.3).** A diaphragm is flexible when its computed maximum in-plane deflection is more than 2 × the average story drift of the adjoining vertical elements, under the equivalent tributary load [S2, p. 15]. Tech Brief 10 notes that wood structural panel diaphragms "often cannot meet this criterion" [S2, p. 15]. The prescriptive path is the one that matters for this app.

**Tributary-area distribution is the accepted method:**

- AWC SDPWS-2021 §4.1.7.1: "When a diaphragm is idealized as flexible in accordance with ASCE 7, the diaphragm shear forces shall be distributed to the vertical elements of the lateral force-resisting system (LFRS) of the story below based on tributary area." [S3, p. 17]
- Tech Brief 10 recommends tributary-area analysis "for the great majority of buildings", with drift limits applied at each wall line [S2, p. 16]. It describes the method as a line drawn midway between bracing walls, then simple-span beams between lines [S2, p. 25].

**Accidental torsion is not required for flexible diaphragms.**

- Tech Brief 10: "Where rigid diaphragm analysis is performed, both actual and accidental torsion are required"; the same applies to semi-rigid [S2, p. 15]. Flexible analysis ignores torsion.
- ASCE 7 §12.8.4.2 opens "Where diaphragms are not flexible…" (wording **UNVERIFIED**).
- FEMA P-2192 notes that 7-22 ties accidental-torsion consideration to Type 1a/1b torsional irregularity [S1, pp. 146, 191]. That only applies to non-flexible diaphragms anyway.

**SDPWS limits the app should flag** (wood diaphragms):

- **Open-front / cantilevered diaphragms.** Diaphragms that cantilever more than **6 ft** past the nearest line of vertical elements must be modeled as rigid or semi-rigid for loading parallel to the open side, with drift checks at the edges [S3, §4.2.6.1 and Exception, pp. 19–20].
- **Torsional irregularity.** The extra torsional-irregularity requirements apply to diaphragms modeled as semi-rigid or rigid [S3, §4.2.5.1, p. 19].
- **App rule:** require a resisting line at both ends of every span, or warn when an overhang is more than 6 ft.

### 2.5 Collectors and Ω₀ (Q4)

**What a collector does.** "A diaphragm collector collects the diaphragm unit shear along the diaphragm boundary (line of the diaphragm reaction) and transmits this force to the vertical elements" [S2, p. 8]. At an interior line, it collects unit shear from **both** adjacent spans [S2, pp. 8–9].

**How to compute the force** [S2, p. 22, Fig. 5-1]:

- Collector force = unit shear in the diaphragm (summed from both sides of the line) × collector length, then × Ω₀ where it applies.
- "It is useful to draw the diaphragm shear diagram and then develop the collector diagram based on the shear diagram."
- Where a wall has an opening, the collector force goes from tension at one end of the opening to compression at the other [S2, p. 9, Fig. 3-5].
- Collectors should ideally extend the full length of the supporting wall [S2, p. 22].

**Worked precedent.** FEMA P-2192 roof collector: v = 1.26 klf; T/C = 1.26 klf × 30 ft × Ω₀ (2.0) = 76 kips [S1, p. 278].

**Force level:** use F_px (inertial). Add transfer forces if any, and amplify by Ω₀ where required [S2, p. 22; S1, p. 255].

**When Ω₀ applies (ASCE 7-22 §12.10.2.1 and §12.10.1.1):**

- **SDC C–F:** "all diaphragm forces are required to be amplified by Ω₀ to design collectors and their connections to vertical elements" [S1, p. 255].
- **SDC B:** "the diaphragm transfer forces are required to be amplified by Ω₀ …, while the F_px forces are not" [S1, p. 255].
- **Cap:** the amplified forces need not exceed the capacity-limited horizontal seismic load effect, E_cl (§11.3) [S1, p. 255].
- **Light-frame exception:** "Systems braced only by wood light-frame walls … are exempt from overstrength forces and need only be designed for the force level used for design of the sheathing and chords" [S2, p. 22].
  - FEMA P-2192 confirms that 7-22 §12.10.2.1 still "identifies conditions where amplification by Ω₀ is not required" [S1, pp. 255, 278].
  - The **exact 7-22 wording of the exceptions is UNVERIFIED.** My recollection of the 7-16 form: in "structures or portions thereof braced entirely by light-frame shear walls", collectors, splices, and their connections need only be designed with the basic load combinations using the §12.10.1.1 forces.
- **The "maximum of three" rule (UNVERIFIED).** My recollection of 7-16 §12.10.2.1 is that collectors in SDC C–F are designed for the maximum of:
  1. Ω₀ × forces from the ELF procedure (§12.8);
  2. Ω₀ × F_px from Eq. 12.10-1;
  3. the minimum F_px from Eq. 12.10-2, **without** Ω₀.

  This is why the worked example in 4.1 multiplies Ω₀ by the Eq. 12.10-1 level, not by the 0.2 minimum.
- **Ω₀ values.** For wood structural panel shear walls, Ω₀ = 3 [S1, p. 266]. A Table 12.2-1 footnote lets Ω₀ ≥ 2.5 be reduced by 0.5 for flexible diaphragms: **UNVERIFIED** (would make 3 → 2.5).

**Other collector notes:**

- Sheathing boundary nailing into a collector uses the sheathing force level, even when the collector itself needs Ω₀ [S2, p. 21].
- With certain plan irregularities in SDC D–F, collector forces go up 25% unless Ω₀ forces are used (§12.3.3.4) [S2, pp. 22–23]. Out of scope; flag it.

### 2.6 Chord forces (Q5)

- **Basic rule.** The diaphragm moment from "simple statics for a simply supported beam is resisted by a force couple at the extremities of the diaphragm (tension at one edge and compression at the opposite edge)" [S2, p. 8]. So **T = C = M/d** [S2, p. 25].
- **Continuous diaphragms over interior lines.** "When wood diaphragms extend over lines of vertical elements, it is typically assumed that the diaphragm can be broken into multiple simple span beams" [S2, p. 25, and Fig. 3-1(b) on p. 5, which draws a "Hinge" at the interior line].
  - Common practice ignores continuity in design but details the chords for nominal continuity.
  - Using full continuity is allowed if the shears and moments match that assumption. It gives higher unit shears and boundary forces near interior supports [S2, p. 25].
  - **Recommendation: simple spans.**
- **Force level.** Chords use the same force level as the sheathing: F_px for inertial forces, plus any transfer forces [S2, p. 21]. **No Ω₀ on chords.** Ω₀ is a collector requirement.
- **Chord vs collector depends on load direction.** The same boundary member is a chord for one load direction and a collector for the other [S2, p. 23].
- **Plan offsets at a line are fine.** With simple-span modeling, a plan offset that happens *at* a resisting line is not a re-entrant corner. Re-entrant corners only count *within* a span [S2, p. 23]. This makes stepped plans manageable if every step sits on a resisting line.

### 2.7 Diaphragm unit shear, shear and moment diagrams (Q6)

For a span of length L between two adjacent lines, with depth d (the dimension parallel to the load, i.e., the chord spacing) and uniform load w [S2, p. 25]:

- **Maximum shear (the reaction):** V = R = wL/2
- **Unit shear:** v = V/d. The shear is assumed uniform over the depth, not parabolic [S2, p. 25].
- **Moment:** M = wL²/8 at midspan
- **Chord force:** C = T = M/d

Along the span, with s measured from the left line (standard beam statics, consistent with the above):

- V(s) = w·(L/2 − s)
- v(s) = V(s)/d
- M(s) = w·s·(L − s)/2
- T(s) = M(s)/d

**At an interior line:**

- The sheathing unit shear on each side is that span's own R/d.
- The collector collects the **sum** of the two sides [S2, pp. 8–9, 22].
- The diaphragm reaction at the line is R_left-span + R_right-span.

### 2.8 Redundancy factor ρ and load combinations (Q7)

- **Values.** ρ is either 1.0 or 1.3 [S1, p. 66].
  - ρ = 1.0 when the §12.3.4.2 conditions are met (e.g., the "number of bays" requirement) [S1, pp. 190, 235].
  - ρ = 1.0 automatically in SDC B and C, and 1.3 by default in SDC D–F unless §12.3.4.2 is met: **UNVERIFIED** (§12.3.4.1 not read).
  - Light-frame bays counted as 2 × wall length / story height: **UNVERIFIED**.
- **Diaphragms: ρ = 1.0.** "In accordance with Section 12.3.4.1, rho (ρ) is assumed to be 1.0 for diaphragm design" [S1, p. 247]. "For purposes of determining diaphragm design forces, ρ is set to 1.0, whether or not ρ is 1.0 for design of the vertical elements" [S1, p. 275].
  - The calculated ρ does apply to diaphragm **transfer** forces [S2, p. 20].
- **Collectors designed with Ω₀** use ρ = 1.0, since Ω₀ replaces ρ (§12.4.3): **UNVERIFIED**, but standard.
- **LFRS lines** use E_h = ρ·Q_E (Eq. 12.4-3) [S1, p. 234].
- **Vertical seismic:** E_v = 0.2·S_DS·D (Eq. 12.4-4a) [S1, p. 234].
- **Strength combinations** (§2.3.6) [S1, pp. 234, 239]:
  - 1.2D + E_v + E_h + L + 0.2S
  - 0.9D − E_v + E_h
- **ASD:** seismic demands × 0.7 [S1, p. 269].
- **Overstrength:** E_mh = Ω₀·Q_E (§12.4.3) [S1, p. 277].

**What the app should report.** The app computes demands, not designs, so report the *horizontal* seismic effect only. Leave E_v and the gravity combinations to the engineer.

| Element | Strength-level E (kips, plf) | ASD |
|---|---|---|
| LFRS line demand | ρ·Q_E from V (ρ is a user input) | 0.7 × |
| Diaphragm shear, unit shear, chords | F_px-level, ρ = 1.0 | 0.7 × |
| Collectors | F_px-level, × Ω₀ when the toggle is on | 0.7 × |

### 2.9 Wind (Q8, lower priority)

- **ASCE 7-22 changes.**
  - Deleted "the simplified methods (Chapters 27, 28, and 30)" [S8, p. 9].
  - Added a new tornado chapter (Ch. 32) [S8, p. 9].
  - Changed wind speed maps, mostly in hurricane-prone regions [S8, pp. 1–2].
  - Some mapped speeds are available only through the ASCE 7 Hazard Tool [S8, p. 9; S9].
- **Remaining routes for MWFRS on a low-rise rectangular building:**
  - Ch. 27 Part 1 (directional procedure), or
  - Ch. 28 Part 1 (envelope procedure for low-rise buildings).
- **Inputs either route needs:**
  - basic wind speed V (by risk category)
  - exposure category
  - K_zt, K_d, K_e
  - enclosure classification (GC_pi)
  - mean roof height, roof slope, plan dimensions
  - pressure coefficients by zone (the envelope procedure also has end zones)

  Applicability limits and coefficient details: **UNVERIFIED** (ASCE 7 not read).
- **Minimum design wind load** (§27.1.5 / §28.3.6): 16 psf on the wall area and 8 psf on the roof area, projected on a vertical plane. **UNVERIFIED** (7-16 values; I believe 7-22 is unchanged).
- **Recommendation: seismic-only code calculation.** Support wind through the direct-force mode: the user enters the MWFRS force, or plf, per direction and level. The diaphragm, chord, and collector math is the same for any uniform w. Note that wind has no F_px, ρ, or Ω₀, so the direct mode should let the user set these factors to 1.0.

### 2.10 USGS Seismic Design Web Services API (Q9)

USGS lists the ASCE 7-22 web service at `https://earthquake.usgs.gov/ws/building-codes/asce7-22` and the ASCE 7-16 service at `https://earthquake.usgs.gov/ws/building-codes/asce7-16` [S4]. FEMA P-2192 describes the service, its fields, and the DOI landing page `https://doi.org/10.5066/F7NK3C76` [S1, pp. 94–95; S6]. The HTML documentation page is a JavaScript app that would not render for me, so the details below come from **live calls made on 2026-10-27**.

**Endpoint (verified):**

```
GET https://earthquake.usgs.gov/ws/building-codes/asce7-22/calculate
    ?latitude=37.8044&longitude=-122.2712&riskCategory=II&siteClass=D&title=Oakland
```

The legacy URL `https://earthquake.usgs.gov/ws/designmaps/asce7-22.json?...` returns **301** to the path above. The redirect `Location` is `http:`, so call the `https://.../building-codes/...` URL directly. The same pattern works for `asce7-16`.

**Query parameters (verified from the service's validation errors):**

| Parameter | Values |
|---|---|
| `latitude`, `longitude` | Decimal degrees |
| `riskCategory` | `I`, `II`, `III`, `IV`, `N` |
| `siteClass` | `A`, `B`, `B-estimated`, `BC`, `C`, `CD`, `D`, `D-default`, `DEFAULT`, `DE`, `E` (same list for 7-16) |
| `title` | Free text, optional |

If `riskCategory` and `siteClass` are missing, the service returns a "usage" payload instead of values.

**Response fields (7-22), under `response.data`:**

- `sds`, `sd1`: design values, already ⅔ of `sms` and `sm1`
- `sms`, `sm1`
- `ss`, `s1`
- `pgam`
- `sdc`: Seismic Design Category for the given risk category
- `tl` (s), `ts`, `t0`
- `cv`
- `multiPeriodDesignSpectrum{periods[], ordinates[]}`
- `multiPeriodMCErSpectrum`, `twoPeriodDesignSpectrum`, `twoPeriodMCErSpectrum`, `underlyingData{...}`

Under `response.metadata`: `vs30`, `modelVersion` (`v5.0.x`), and the spectral floors. FEMA describes the same field names [S1, pp. 94–95].

**Sample results (verified 2026-10-27):**

| Location | Edition, RC, Site | sds | sd1 | s1 | sdc | tl |
|---|---|---|---|---|---|---|
| Oakland 37.8044, −122.2712 | 7-22, II, D | 1.27 | 1.13 | 0.66 | D | 8 |
| same | 7-22, II, DEFAULT | 1.38 | 1.13 | 0.66 | D | 8 |
| Los Angeles 34.0522, −118.2437 | 7-22, III, C | 1.53 | 0.68 | 0.72 | D | 8 |
| Oakland | **7-16**, II, D | 1.145 | **null** | 0.651 | **null** | 8 |

In the 7-16 / Site Class D case, `fv` is null with `fv_note: "See Section 11.4.8"`, and `sdcs: "D"` is the short-period SDC. **The app must handle a null `sd1` for 7-16** (see 2.1, the §11.4.8 site-specific rule [S1, pp. 102–103]).

**Auth, CORS, limits:**

- No API key or auth was needed.
- The response carried `Access-Control-Allow-Origin: *` on a cache-miss call, so a browser can call it directly with no proxy.
- `Cache-Control: max-age=900`.
- A fresh call took about 1.7 s.
- I found no documented rate limit: **UNVERIFIED**. Debounce the lookup button anyway.
- FEMA notes the service interpolates spatially between gridded data [S1, p. 94].

---

## 3. Formulas for the app

Units: ft, kip, plf (lb/ft), psf, k-ft. Strength-level unless noted. "Load direction" is the direction of the seismic force. The diaphragm **spans** perpendicular to it, between lines that run **parallel** to it.

**Geometry (per load direction)**

| # | Quantity | Formula | Notes |
|---|---|---|---|
| G1 | Lines | Positions x₁ < x₂ < … < x_m, measured along the span direction | Lines run parallel to the load |
| G2 | Span j | L_j = x_{j+1} − x_j | Simple span, hinge at interior lines [S2, p. 25] |
| G3 | Depth | d = plan dimension parallel to the load (chord spacing) | Rectangular plan |
| G4 | Tributary width of line i | b_i = (x_i − x_{i−1})/2 + (x_{i+1} − x_i)/2 | End lines get one half-span, plus any overhang (warn if overhang > 6 ft [S3, §4.2.6]) |

**Seismic weight (psf mode)** (§12.7.2; components UNVERIFIED, see section 5)

| # | Quantity | Formula |
|---|---|---|
| W1 | Wall line load at a level (plf) | q_wall = wall_psf × h_trib, where h_trib = h_story_below/2 + h_story_above/2 (+ parapet at the roof) |
| W2 | Level weight (kips) | w_x = (DL_psf + partition_psf)·A_plan/1000 + q_wall·perimeter/1000 (+ other items) |
| W3 | Diaphragm weight | w_px = w_x − (weight of walls parallel to the load). Excluding them is optional [S1, p. 253]; default: exclude. |

**Base shear (§12.8)**

| # | Quantity | Formula | Section |
|---|---|---|---|
| B1 | Period | T = T_a = C_t·h_n^x. C_t = 0.020, x = 0.75 for wood shear walls / "all other" | §12.8.2.1 |
| B2 | C_s | C_s = S_DS·I_e/R | §12.8.1.1 |
| B3 | Upper limit | C_s ≤ S_D1·I_e/(T·R) if T ≤ T_L; ≤ S_D1·T_L·I_e/(T²·R) if T > T_L | §12.8.1.1 |
| B4 | Lower limits | C_s ≥ max(0.044·S_DS·I_e, 0.01). If S1 ≥ 0.6: C_s ≥ 0.5·S1·I_e/R | §12.8.1.1 |
| B5 | Base shear | V = C_s·W | Eq. 12.8-1 |
| B6 | Vertical distribution | F_x = V·w_x·h_x^k / Σ w_i·h_i^k. k = 1 (T ≤ 0.5 s), 2 (T ≥ 2.5 s), linear between | §12.8.3 |
| B7 | Story shear | V_x = Σ_{i ≥ x} F_i | §12.8.4 |

**LFRS line demand (per story, per direction)**

| # | Quantity | Formula |
|---|---|---|
| L1 | Uniform load for vertical elements | w_V,x = F_x·(w_px/w_x)/L_total (kips/ft), i.e., the level force on the diaphragm portion, spread uniformly along the span direction |
| L2 | Line force at level x | P_i,x = w_V,x·b_i + (F_x/w_x)·(weight of walls on line i parallel to the load) |
| L3 | Line demand in story x | Q_i = Σ_{levels ≥ x} P_i,level (stacked lines only) |
| L4 | Reported | E = ρ·Q_i (ρ is a user input, 1.0 or 1.3); ASD = 0.7·E |

Phase-1 simplification: put all of W uniformly on the plan, so P_i = V·b_i/L_total.

**Diaphragm (per level, per direction)** (§12.10.1.1, ρ = 1.0)

| # | Quantity | Formula |
|---|---|---|
| D1 | F_px | F_px,raw = (Σ_{i ≥ x} F_i / Σ_{i ≥ x} w_i)·w_px. Single story: C_s·w_px. Then F_px = min(max(F_px,raw, 0.2·S_DS·I_e·w_px), 0.4·S_DS·I_e·w_px). Per FEMA P-2192, also not less than F_x [S1, p. 255]. |
| D2 | Diaphragm load | w_D = F_px/L_total (klf) |
| D3 | Span reactions | R_j = w_D·L_j/2 at each end of span j |
| D4 | Line reaction | R_line,i = R_(span left of i) + R_(span right of i) |
| D5 | Unit shear | v_j = R_j/d (plf) on each side of a line, each span separately |
| D6 | Shear diagram | V_j(s) = w_D·(L_j/2 − s) |
| D7 | Moment and chord | M_j(s) = w_D·s·(L_j − s)/2; M_j,max = w_D·L_j²/8 |
| D8 | Chord force | T = C = M_j/d (max at midspan), each span separately. No Ω₀. |

**Collector along line i** (line length d, wall segments [a_k, b_k] along the line)

| # | Quantity | Formula |
|---|---|---|
| C1 | Unit shear into the collector | v_in = R_line,i/d (plf, both sides summed) |
| C2 | Unit shear out to the walls | v_wall = R_line,i/ΣL_wall,k. Assumes all segments share by length (same construction). Mixed wall types: UNVERIFIED. |
| C3 | Collector force | F(s) = v_in·s − v_wall·Σ_k overlap([0, s], [a_k, b_k]), for s ∈ [0, d]. Check: F(0) = F(d) = 0. |
| C4 | Single wall [a, b] | max \|F\| = v_in·max(a, d − b) |
| C5 | With Ω₀ toggle on | F_Em = max( Ω₀ × C3 computed with F_px,raw , C3 computed with governing F_px ). Uses the "maximum of" rule (UNVERIFIED); simpler and conservative: Ω₀ × C3 at governing F_px. |
| C6 | ASD | 0.7 × the above |

Sign: T and C reverse with load direction. Report ± (T/C).

---

## 4. Worked example (unit-test cases)

### 4.1 Single story

**Inputs**

| Item | Value |
|---|---|
| Plan | 100 ft (E-W) × 50 ft (N-S), one story, h_n = 16 ft |
| Load direction | **N-S**. The diaphragm spans E-W. d = 50 ft, L_total = 100 ft. |
| Resisting lines (N-S, full depth) | Line 1 at x = 0, Line 2 at x = 40, Line 3 at x = 100 |
| Spans | A = 40 ft (lines 1–2), B = 60 ft (lines 2–3) |
| Roof dead load | 20 psf |
| Exterior walls | 12.5 psf × 8 ft tributary height = 100 plf on all four walls |
| Seismic parameters | S_DS = 1.30, S_D1 = 0.65, S1 = 0.55 (< 0.6, so Eq. 12.8-6 n/a), Risk Category II, I_e = 1.0, SDC D |
| System | Wood structural panel shear walls: R = 6.5, Ω₀ = 3, C_t = 0.02, x = 0.75 |
| Line 2 wall | One 20 ft wall at y = 0 to 20 (south end). The line is 50 ft long, so a 30 ft collector runs to the north. |

**Weights**

| Item | Calculation | Result |
|---|---|---|
| Roof | 20 psf × 100 × 50 | 100.0 kips |
| Walls | 100 plf × 300 ft perimeter | 30.0 kips |
| W | | **130.0 kips** |
| w_px (N-S), excluding the two 50 ft N-S end walls (5.0 kips each) | 130 − 10 | **120.0 kips**, or 1,200 plf along the span (1,000 roof + 2 × 100 walls) |

**Base shear**

| Item | Calculation | Result |
|---|---|---|
| T_a | 0.02 × 16^0.75 = 0.02 × 8 | **0.16 s** |
| C_s = S_DS·I_e/R | 1.30/6.5 | **0.200** |
| Upper limit | 0.65/(0.16 × 6.5) = 0.625 | Not governing |
| Lower limit | 0.044 × 1.30 = 0.0572 | Not governing |
| V = C_s·W | 0.200 × 130 | **26.0 kips** |

**LFRS line demands** (E, with ρ = 1.0; method L1–L2)

| Line | Tributary width b_i | Diaphragm part (0.200 × 1.2 klf × b_i) | Own N-S wall (0.200 × 5.0) | **P_i (kips)** | If ρ = 1.3 |
|---|---|---|---|---|---|
| 1 | 20 ft | 4.80 | 1.00 | **5.80** | 7.54 |
| 2 | 50 ft | 12.00 | 0 | **12.00** | 15.60 |
| 3 | 30 ft | 7.20 | 1.00 | **8.20** | 10.66 |
| Σ | 100 ft | 24.00 | 2.00 | **26.00** = V ✓ | |

Phase-1 simplified check (W uniform on the plan, P_i = V·b_i/100): **5.20 / 13.00 / 7.80 kips**.

**Diaphragm force (ρ = 1.0)**

| Item | Calculation | Result |
|---|---|---|
| F_px,raw | C_s·w_px = 0.200 × 120 | 24.0 kips |
| Minimum | 0.2 × 1.30 × 1.0 × 120 | **31.2 kips (governs)** |
| Maximum | 0.4 × 1.30 × 120 | 62.4 kips |
| w_D | 31.2/100 | **0.312 klf = 312 plf** |

**Diaphragm shear, unit shear, chords (per span)**

| Span | L | R each end = w_D·L/2 | v = R/d | M = w_D·L²/8 | **T = C = M/d** |
|---|---|---|---|---|---|
| A | 40 ft | 6.24 kips | 124.8 plf | 62.4 k-ft | **1.248 kips** |
| B | 60 ft | 9.36 kips | 187.2 plf | 140.4 k-ft | **2.808 kips** |

Diaphragm reactions at the lines: R₁ = 6.24, R₂ = 6.24 + 9.36 = **15.60**, R₃ = 9.36 kips. Σ = 31.2 = F_px ✓.

ASD: multiply by 0.7. For example, the span B chord is 1.966 kips.

**Collector on Line 2** (wall at y = 0 to 20, line length d = 50 ft)

| Item | Calculation | Result |
|---|---|---|
| v_in | 15.60/50 | 0.312 klf (312 plf) |
| v_wall | 15.60/20 | 0.780 klf (780 plf) |
| F(y) north of the wall, 20 ≤ y ≤ 50 | 0.312 × (50 − y) | Rises linearly from 0 at y = 50 |
| **F at the wall end (y = 20)** | 0.312 × 30 | **9.36 kips** (E, F_px-level) |
| F(y) across the wall, 0 ≤ y ≤ 20 | Linear to 0 | 0 at y = 0 ✓ |

Check: 0.312·50 − 0.780·20 = 0 ✓.

- **Light-frame walls:** Ω₀ is not required (exception), so the demand is **9.36 kips** (E). ASD = **6.55 kips**.
- **If Ω₀ applied** (e.g., the line were a steel braced frame; illustrative only, since R would differ):
  - Collector at the F_px,raw level: w = 0.240 klf, so R₂ = 12.0 kips and v_in = 0.240 klf, giving 0.240 × 30 = 7.20 kips.
  - Ω₀ × 7.20 = **21.6 kips** with Ω₀ = 3, or **18.0 kips** with Ω₀ = 2.5.
  - Take the max of that and 9.36, so **21.6 kips** governs.
  - The simpler conservative version, Ω₀ × 9.36 = 28.08 kips.
- **Extra test case:** a 20 ft wall **centered** on Line 2 (y = 15 to 35) gives a collector force of 0.312 × 15 = **4.68 kips** at each wall end. One end is in tension and the other in compression.

### 4.2 Two-story variant (same plan and lines, stacked)

**Inputs**

| Item | Value |
|---|---|
| Levels | Level 2 floor at h = 10 ft, roof at h = 20 ft. h_n = 20 ft. |
| Weights | w₂ = 200 kips, w_roof = 100 kips, W = 300 kips |
| Simplification | Weight spread uniformly on the plan, and w_px = w_x (parallel walls not excluded) |
| Other parameters | Same S_DS, S_D1, R, I_e as 4.1 |

**Base shear:** T_a = 0.02 × 20^0.75 = 0.189 s ≤ 0.5 s, so **k = 1**. C_s = 0.200. **V = 0.200 × 300 = 60.0 kips.**

**Vertical distribution**

| Level | w_x | h_x | w_x·h_x | C_vx | **F_x** | Story shear below the level |
|---|---|---|---|---|---|---|
| Roof | 100 | 20 | 2,000 | 0.50 | **30.0** | V_story2 = **30.0** |
| 2 | 200 | 10 | 2,000 | 0.50 | **30.0** | V_story1 = **60.0** = V ✓ |
| Σ | 300 | | 4,000 | 1.00 | 60.0 | |

**F_px per level**

| Level | Σ F_i / Σ w_i (i ≥ x) | F_px,raw | Min 0.2·S_DS·I_e·w_px | Max 0.4·S_DS·I_e·w_px | **F_px** | w_D |
|---|---|---|---|---|---|---|
| Roof | 30/100 = 0.30 | 30.0 | 26.0 | 52.0 | **30.0** (Eq. 12.10-1 governs) | 300 plf |
| 2 | 60/300 = 0.20 | 40.0 | 52.0 | 104.0 | **52.0** (minimum governs) | 520 plf |

Note: Level 2 has F_x = 30 kips but F_px = 52 kips. The level 2 diaphragm is designed for 52, while the first-story walls take the 60 kip story shear.

**LFRS line demands by story** (tributary fractions 0.2 / 0.5 / 0.3; E with ρ = 1.0)

| Line | Story 2 (from the roof) | **Story 1 (ground level)** = 0.2/0.5/0.3 × 60 |
|---|---|---|
| 1 | 6.0 | **12.0** |
| 2 | 15.0 | **30.0** (= 15 from the roof + 15 from level 2) |
| 3 | 9.0 | **18.0** |
| Σ | 30.0 | **60.0** ✓ |

**Diaphragm results by level**

| Level, span | R each end | v | M | T = C |
|---|---|---|---|---|
| Roof, A (40 ft) | 6.0 k | 120 plf | 60 k-ft | 1.20 k |
| Roof, B (60 ft) | 9.0 k | 180 plf | 135 k-ft | 2.70 k |
| Level 2, A | 10.4 k | 208 plf | 104 k-ft | 2.08 k |
| Level 2, B | 15.6 k | 312 plf | 234 k-ft | **4.68 k** |

---

## 5. Answers to the problem.md open questions (section 8)

| Open question | Recommended answer for the hackathon | Why |
|---|---|---|
| **Code and edition** | **ASCE 7-22**, as referenced by the 2024 IBC. Label outputs "ASCE 7-22 §…". Allow a 7-16 toggle only for the USGS lookup. | The ELF and F_px math is effectively the same in both editions. The difference is how S_DS/S_D1 are obtained [S1, p. 33]. 2024 IBC → 7-22 [S8, p. 1]. |
| **Load types** | **Seismic ELF only** for the code calculation. Wind only via direct-force mode. | 7-22 deleted the simplified wind methods [S8, p. 9]. The full Ch. 27/28 inputs are too many for 5 hours. ELF is how almost all wood-diaphragm buildings are designed [S2, p. 25]. |
| **Seismic inputs** | User types S_DS, S_D1, S1, I_e (or picks a risk category), R, Ω₀, h_n, ρ, and SDC. Optional "Look up from location" button calls USGS 7-22 and fills S_DS, S_D1, S1, SDC, T_L. | The API is free, keyless, and CORS-enabled (verified). Manual entry keeps the demo safe if the network fails. |
| **Seismic weight** | Support **both** modes (see the psf mode and direct-force mode notes below the table). | Team decision from the scope update. |
| **Diaphragm force: story force or F_px?** | **Both, by element.** LFRS lines get V-level forces (F_x, story shear) × ρ. Diaphragm, chords, and collectors get F_px with ρ = 1.0. Show both, and label the governing F_px equation (12.10-1, the minimum, or the maximum). | This is what ASCE 7 requires [S1, pp. 254–255, 268; S2, pp. 17–20]. For wood (R = 6.5) the minimum governs, so using V for the diaphragm would be about 23% unconservative. |
| **Stories** | Phase 1: single level. Phase 2: multi-story, with **identical plan and stacked lines** at every level. Block or warn on non-stacked lines. | Non-stacked lines create transfer forces (§12.10.1.1, needing ρ and sometimes Ω₀) [S2, p. 20; S1, p. 255]. That is out of scope. |
| **Plan shape** | **Rectangles only.** Stretch goal: L-shapes made of rectangles where every plan step sits on a resisting line. Each span is then its own rectangle with its own depth d. | Under simple-span modeling, offsets at supports are not re-entrant corners [S2, p. 23]. Steps inside a span need re-entrant-corner and drag analysis, which is out of scope. |
| **Line orientation** | Orthogonal N-S and E-W lines only, snapped to a grid (e.g., 1 ft). Each line runs the full plan depth (the collector extends full length). Walls are segments on a line. | Matches the beam analogy (uniform shear across the full depth) [S2, p. 25]. |
| **Tributary rule** | Half the distance to the adjacent line on each side. End lines get the half-span plus any overhang. **Warn** if an overhang is more than 6 ft. Variable-depth diaphragms: out of scope (rectangles only). | Tributary-area / simple-span method [S2, p. 25; S3, §4.1.7.1]. 6 ft cantilever limit [S3, §4.2.6.1 Exception]. |
| **Chords** | Yes: **T = C = M/d with simple-span moments between adjacent lines**, treating interior lines as hinges. Show the moment diagram per span. No Ω₀. | Standard practice per [S2, pp. 5, 25]. Continuity may be ignored if the chords are detailed for nominal continuity. |
| **Collectors** | Collectors run the **full length of every resisting line**, collecting diaphragm shear from both sides and delivering it to the wall/frame segments on that line. **Show the force diagram** F(s) along each line. | Matches [S2, pp. 8–9, 22, Figs. 3-5 and 5-1]. The diagram is cheap to compute (piecewise linear) and is the most useful visual. |
| **Overstrength** | **Yes, as a toggle.** Default ON for SDC C–F unless the system is "light-frame shear walls" (default OFF). OFF for SDC B. Show E and Ω₀·E columns. | §12.10.2.1 [S1, p. 255; S2, p. 22]. Exception wording is UNVERIFIED, so let the engineer override. |
| **Diaphragm openings** | **Leave out.** | Needs subdiaphragm or opening analysis (APA / NCSEA methods) [S2, p. 9]. Not doable in 5 hours. |
| **Units** | Imperial only: ft, kips, plf, psf, k-ft. | Matches the users and all sources. |
| **Output** | On-screen tables plus CSV export if time allows. | Not a code question. CSV is a few lines of code. |
| **Persistence** | Save and load JSON to localStorage or a file, if time allows. | Not a code question. |

### psf mode: inputs to collect

These follow ASCE 7 §12.7.2 effective seismic weight. The component list is **UNVERIFIED** against the 7-22 text; the FEMA example [S1, p. 267] shows the roof + walls × tributary-height pattern.

- **Per level:**
  - Roof or floor dead load in psf (sheathing, framing, roofing or topping, ceiling, MEP).
  - Partition allowance in psf (floors only). ASCE 7 requires the actual partition weight or at least 10 psf of floor area where partitions are in the floor design (UNVERIFIED). FEMA's multi-story example includes partitions as 10 psf and takes exterior walls at "(12/2 + 4 ft)", i.e., half the story height plus a 4 ft parapet [S1, p. 273].
- **Exterior wall weight** in psf, plus story heights. The app computes the tributary height:
  - Roof: h_top/2 + parapet height.
  - Floors: (h_below + h_above)/2.

  This mirrors FEMA's one-story example: "Side walls: 10 psf (10 ft)…", "End walls: 10 psf (25 ft/2)…" [S1, p. 267].
- **Optional interior wall lines** in plf (the user draws them) or as a psf allowance.
- **Optional extra items:**
  - Flat-roof snow: include 20% of the design snow load where the flat roof snow load is more than 30 psf (UNVERIFIED).
  - Storage areas: 25% of the floor live load (UNVERIFIED).
  - Permanent equipment, as point weights in kips.
- **Checkbox:** "Exclude walls parallel to the load from w_px". Default ON. It is permitted and at the engineer's discretion [S1, p. 253].
- **App outputs:** W, w_x per level, and w_px per direction. Show them in a weight table so the user can check.

### Direct-force mode: what to accept

- **Per level, per direction (N-S and E-W):** a **force in kips**. For one story, this is the single total force. The app derives w = F/L along the span direction.
- **Optional separate diaphragm force F_px in kips per level and direction.** If blank, F_px = the entered force. Without this field, a user entering an ELF story force would under-design the diaphragm for wood.
- **Convenience input:** let the user type a **uniform plf** instead of kips for each level and direction. Convert it to kips internally, so there is one data model: kips per level per direction.
- **Flags:**
  - Strength-level vs ASD (the ×0.7 / ÷0.7 conversion for display).
  - The Ω₀ value for collectors.
  - ρ for the lines.

  For wind, set Ω₀ = 1 and ρ = 1.
- **Multi-story:** the per-level forces are F_x. The app accumulates story shear down the stacked lines exactly as in psf mode.

---

## 6. Sources

1. **[S1]** FEMA P-2192-V1, *2020 NEHRP Recommended Seismic Provisions: Design Examples* (ASCE/SEI 7-22 basis), Building Seismic Safety Council / NIBS for FEMA. Pages used:
   - Ch. 1, §1.4.1, pp. 32–35
   - Ch. 2, p. 66
   - Ch. 3, §3.2.3, pp. 94–95, and §3.3.3–3.3.4, pp. 99–104
   - Ch. 4, pp. 146–148
   - Ch. 5, §5.5.3.6, pp. 190–192
   - Ch. 6, pp. 234–239
   - Ch. 7 (K. Cobeen), pp. 247–278, including Table 7-1 (p. 252), §7.3.1 (pp. 253–255), the §7.4.1 one-story wood example (pp. 266–269), §7.4.2 (pp. 269–271), and the §7.5.1 multi-story example with Tables 7-6 to 7-8 and collector forces (pp. 274–278)

   PDF: https://nibs.org/wp-content/uploads/2025/04/fema_nehrp_design-examples-and-training-materials_volume01.pdf. Landing page: https://nibs.org/2020-nehrp-recommended-seismic-provisions-design-examples-fema-p-2192-volume-i/
2. **[S2]** NIST GCR 14-917-32, *NEHRP Seismic Design Technical Brief No. 10: Seismic Design of Wood Light-Frame Structural Diaphragm Systems: A Guide for Practicing Engineers* (Cobeen, Dolan, Thompson, van de Lindt), 2014. Pages used:
   - p. 5 (Fig. 3-1)
   - pp. 8–9 (chords, collectors, Fig. 3-5)
   - pp. 15–16 (§4.2 classification, tributary-area recommendation)
   - pp. 17–18 (Fig. 4-5, Fig. 4-6)
   - pp. 20–23 (§5 F_px, ρ, chord and collector forces, light-frame Ω₀ exemption, Fig. 5-1, §5.3)
   - p. 25 (§6.1 beam-analogy formulas, multiple simple spans)

   PDF: https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=917416. NIST page: https://www.nist.gov/publications/nehrp-seismic-design-technical-brief-no-10-seismic-design-wood-light-frame-structural
3. **[S3]** American Wood Council, *Special Design Provisions for Wind and Seismic (SDPWS-2021) with Commentary*, Chapter 4: §4.1.7 (p. 17), §4.2.5.1 and §4.2.6 (pp. 19–20). Free view-only page: https://awc.org/publications/2021-sdpws/. Chapter 4 file: https://web-media.awc.org/wp-content/uploads/2021/12/17210138/AWC_SDPWS2021_withCommentary_20240204_AWCWebsite-Chapter-4-Lateral-Force-Resisting-Systems.pdf
4. **[S4]** USGS, *Design Ground Motions* portal (lists the ASCE 7-22 and ASCE 7-16 web service URLs). https://www.usgs.gov/programs/earthquake-hazards/design-ground-motions-portal
5. **[S5]** USGS Seismic Design Web Service, ASCE 7-22: https://earthquake.usgs.gov/ws/building-codes/asce7-22. Calculate endpoint: https://earthquake.usgs.gov/ws/building-codes/asce7-22/calculate. ASCE 7-16: https://earthquake.usgs.gov/ws/building-codes/asce7-16/calculate. Live calls made 2026-10-27 (results in §2.10).
6. **[S6]** USGS Seismic Design Web Services, DOI landing page cited by FEMA P-2192: https://doi.org/10.5066/F7NK3C76
7. **[S7]** ASCE/SEI 7-22, *Minimum Design Loads and Associated Criteria for Buildings and Other Structures* (paywalled; **not read directly**). Section numbers are cited as they are quoted in [S1] and [S2]. https://www.asce.org/publications-and-news/asce-7
8. **[S8]** FEMA Fact Sheet, *Highlights of Significant Changes to the Wind Load Provisions of ASCE 7-22*, August 2022, pp. 1–2 and 9. https://www.fema.gov/sites/default/files/documents/fema_asce-7-22-wind-highlights_fact-sheet_2022.pdf
9. **[S9]** ASCE 7 Hazard Tool (wind speeds and other hazards by location): https://asce7hazardtool.online/

### UNVERIFIED items (consolidated)

**ASCE 7-22 text**

- §12.3.1.1 and §12.3.1.3 exact wording (7-10-era paraphrase in [S2]).
- §12.8.4.2 "where diaphragms are not flexible".
- §12.10.2.1 list and exception wording, and the cap.
- §12.3.4.1 and §12.3.4.2 details (SDC B/C ρ = 1.0, light-frame bay counting).
- §12.7.2 components.
- Table 12.2-1 footnote (Ω₀ − 0.5 for flexible diaphragms).
- Table 1.5-2 values other than RC III.
- C_u and C_t/x values other than those quoted.
- §12.8.1.3 in 7-22.
- 7-22 equation numbering.

**Wind and adoption**

- Wind applicability limits and minimum loads (§27.1.5 / §28.3.6).
- 2021 IBC → ASCE 7-16.

**USGS**

- Rate limits (none found).
