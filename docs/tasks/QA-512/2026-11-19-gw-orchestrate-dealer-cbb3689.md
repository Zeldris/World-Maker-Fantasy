# 2026-11-19 · gw-orchestrate-dealer · pending · QA-512

## Why

2 falsos positivos reales de la ronda local 2 (golpe que «encuentra a» alguien; «no consigue encontrar»).

## Alternatives

Quitar `encuentr*` entero: dejaba pasar obtenciones reales.

## Changed because

Regex: `encuentr\w*` no seguido de a/al/su/sus; `consigu\w*` sin «no» delante ni infinitivo detrás.
