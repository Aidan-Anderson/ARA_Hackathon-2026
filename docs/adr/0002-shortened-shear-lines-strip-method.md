# Shortened Shear Lines support only the strip they cover

By default a Shear Line runs the full Diaphragm depth at its position. A user can now shorten a
line on the plan. A shortened line supports only the strip of Diaphragm it covers, so the
Diaphragm is cut into Strips across the depth at the ends of shortened lines. Each Strip is a
simple beam (ADR 0001) between the lines that cover it. Full-depth lines support every Strip, and
Strip reactions add up per line. With no shortened lines there is one Strip and the results are
exactly what they were before.

We chose this over keeping every line full depth (with a Collector dragging load to the wall)
because engineers asked to model interior lines that genuinely stop partway across the building.
Treating the Strips as independent beams ignores shear transfer between them, which is the usual
flexible-diaphragm idealization when nothing drags load across. Chords are reported at each
Strip's edges. Wind is shared among Strips by their share of the depth, and a Transfer Force by
how much of the stopped line overlaps each Strip. A Strip that no line covers is flagged
(`unsupported-strip`) and its load is not carried.
