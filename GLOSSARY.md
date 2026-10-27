# Lateral Load Path (flexible diaphragms)

The language for describing how lateral load travels through a building with
flexible diaphragms: from the diaphragm at each Level, through Collectors and
Chords, into the Lateral Elements on each Shear Line, and down Story by Story.

## Geometry

**Level**:
A diaphragm elevation, such as the roof or the 2nd floor.
_Avoid_: floor (ambiguous between Level and Story)

**Story**:
The space between two Levels, where the Lateral Elements carrying the Levels above it are located.
_Avoid_: floor

**Direction X / Y**:
The direction the lateral load acts in. X-direction load is resisted by Shear Lines parallel to X.

**Diaphragm**:
The horizontal roof or floor structure at a Level. It collects lateral load and spans between Shear Lines. In this project it is always flexible.

**Diaphragm Span**:
The part of a Diaphragm between two adjacent Shear Lines, treated as a simple beam under its actual load.
_Avoid_: bay, segment

**Gridline**:
A reference line on the plan: numbered gridlines (1, 2, 3…) run vertically, lettered gridlines (A, B, C…) run horizontally. A Shear Line often sits on a Gridline but is not the same thing.

**Underlay**:
An imported plan image or PDF page, scaled to real dimensions and shown behind a Level so the user can trace over it.

**Overhang**:
The part of a Diaphragm beyond the outermost Shear Line in a direction, acting as a cantilever from that line.
_Avoid_: cantilever diaphragm

**Opening**:
A rectangular hole in a Diaphragm, such as a stair or shaft.
_Avoid_: penetration, void

**Re-entrant Corner**:
An inside corner of a non-rectangular Diaphragm, where the Chord force at the narrower depth has to be dragged into the wider part.

## Load path

**Shear Line**:
A line in plan, parallel to the load direction, that supports the Diaphragm and receives its reaction.
_Avoid_: resisting line, LFRS line, wall line

**Lateral Element**:
A shear wall or braced frame on a Shear Line. A Shear Line can have more than one, with gaps between them.
_Avoid_: LFRS (as a noun for a single thing), wall

**Diaphragm Reaction**:
The force a Shear Line receives from the Diaphragm Spans on either side, found by treating each span as a simple beam under its actual load.
_Avoid_: tributary load, tributary area, tributary width

**Chord**:
The boundary element at the edge of a Diaphragm Span, perpendicular to the load, that resists the span's bending as a tension/compression couple.

**Collector**:
An element that carries Diaphragm shear to the Lateral Elements along a Shear Line where the line has no wall or frame, or that spreads a Transfer Force into the Diaphragm below.
_Avoid_: drag strut, drag line

**Transfer Force**:
The story shear of a Shear Line that stops at a Level, applied as a point load to the Diaphragm below.

## Loads and results

**Story Force (F_x)**:
The seismic force applied at a Level, used for Shear Lines and Lateral Elements.

**Diaphragm Force (F_px)**:
The seismic force that a Level's Diaphragm, Chords, and Collectors are designed for.

**Load Case**:
One of Seismic X, Seismic Y, Wind X, or Wind Y.

**Demand**:
The force or unit shear an element must resist under a Load Case, without the redundancy factor ρ or overstrength Ω₀.

**Envelope**:
The governing Demand for each element across all Load Cases.
