#!/bin/bash
# Movido a image-generator/scripts/montar.sh (IMG-23); este reenvía para los scripts del banco y las órdenes de los docs.
exec bash "$(cd "$(dirname "$0")/../../../.." && pwd)/image-generator/scripts/montar.sh" "$@"
