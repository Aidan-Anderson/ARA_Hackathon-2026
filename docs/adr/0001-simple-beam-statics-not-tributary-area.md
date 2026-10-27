# Simple-beam statics instead of tributary area

Diaphragm Reactions are found by treating each Diaphragm Span as a simple beam
under its actual load, including depth changes at L/T shapes, Openings, and
Transfer Force point loads. We don't use the usual "half the span to each line"
tributary area. The two only agree for uniformly loaded rectangles. For anything
else, tributary-area reactions don't balance the span's shear and moment
diagrams, and the Chord and Collector demands come from those diagrams.

For example, take a 60 ft span that is 50 ft deep for its first 30 ft and 25 ft
deep for the rest, loaded at 10 psf. Tributary area gives reactions of 15.0 k
and 7.5 k; simple-beam statics gives 13.1 k and 9.4 k. Don't "fix" this back to
tributary area.
