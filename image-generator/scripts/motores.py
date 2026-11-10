#!/usr/bin/env python3
"""IMG-53: tabla única de motores del generador (modelo, texto, VAE, cfg, pasos, tope, LoRA y args de sd-cli).
La leen fase.py (pasos, tope, archivos que faltan, estimaciones, servidor) y generar.sh (`MOTOR=<id>`, con
`motores.py shell <id> <image-generator/>`, que imprime asignaciones de shell y sale con 3 si falta un archivo).
Las recetas salen de docs/producto/plan-imagenes/investigacion-modelos-y-pasos.md; `{M}` en los args es modelos/.
Estimaciones de segundos (paso a 480x192, Final a 1280x512): klein4b medido; el resto, estimación (x2 la 9B, x10 los 20B/20 pasos).
IMG-56, claves opcionales que usa qwen21 (texto a imagen, grande):
  'base'      args de sd-cli que sustituyen a los base de generar.sh (`--flash-attn off,diffusion=on --vae-tiling --params-backend
              disk --max-vram vulkan0=2`); `shell` los exporta como BASE_MOTOR=(…). Sin la clave, generar.sh se queda como estaba.
  'sin_refs'  el motor no admite imagen de entrada ni referencias: fase.py las ignora de forma explícita (sin -r, sin BOCETO, sin
              frases de rol) y el prompt va tal cual; la entrada aceptada se sigue exigiendo y apuntando en camino.json.
  'vigila_mb' umbral del vigilante de memoria de generar.sh (MemAvailable en MB; por defecto 1500); `MIN_VIGILA_MB=` lo manda.
  'tam_paso' / 'tam_final'  (ancho, alto) que sustituyen a los de la receta de la fase en los pasos y en la Final."""
import os
import shlex
import sys

POR_DEFECTO = 'klein4b'
_VAE_KLEIN = 'full_encoder_small_decoder.safetensors'
_QWEN_VL = {'llm': 'Qwen2.5-VL-7B-Instruct.Q4_K_M.gguf', 'mmproj': 'Qwen2.5-VL-7B-Instruct.mmproj-Q8_0.gguf'}

MOTORES = {
    'klein4b': {'nombre': 'FLUX.2 klein 4B', 'modelo': 'flux-2-klein-4b-Q8_0.gguf', 'llm': 'Qwen3-4B-Q4_K_M.gguf',
                'vae': _VAE_KLEIN, 'cfg': '1', 'pasos': 4, 'tope': 1800, 'bin': 'bin', 'extra': [],
                'lora': None, 'perfil': None, 'segundos': {'paso': 40, 'final': 160}, 'estimacion': False},
    'klein9b': {'nombre': 'FLUX.2 klein 9B (Q4)', 'modelo': 'flux-2-klein-9b-Q4_0.gguf', 'llm': 'Qwen3-8B-Q4_K_M.gguf',
                'vae': _VAE_KLEIN, 'cfg': '1', 'pasos': 4, 'tope': 3600, 'bin': 'bin', 'extra': [],
                'lora': None, 'perfil': None, 'segundos': {'paso': 80, 'final': 320}, 'estimacion': True},
    'klein9b-consistencia': {'nombre': 'FLUX.2 klein 9B + consistencia', 'modelo': 'flux-2-klein-9b-Q4_0.gguf',
                             'llm': 'Qwen3-8B-Q4_K_M.gguf', 'vae': _VAE_KLEIN, 'cfg': '1', 'pasos': 4, 'tope': 3600,
                             'bin': 'bin', 'extra': [], 'lora': ('klein9b-consistencia', '0.33'), 'perfil': None,
                             'segundos': {'paso': 90, 'final': 360}, 'estimacion': True},
    'qwen-edit': {'nombre': 'Qwen-Image-Edit 2511 (Q3)', 'modelo': 'qwen-image-edit-2511-Q3_K_S.gguf', 'llm': _QWEN_VL['llm'],
                  'vae': 'qwen_image_vae.safetensors', 'cfg': '2.5', 'pasos': 20, 'tope': 3600, 'bin': 'bin',
                  'extra': ['--llm_vision', '{M}/text/' + _QWEN_VL['mmproj'], '--flow-shift', '3',
                            '--model-args', 'qwen_image_zero_cond_t=true'],
                  'sampler': 'euler', 'lora': None, 'perfil': None, 'segundos': {'paso': 400, 'final': 1600}, 'estimacion': True,
                  'archivos_extra': [('text', _QWEN_VL['mmproj'])]},
    'longcat': {'nombre': 'LongCat Image Edit (Q4)', 'modelo': 'longcat_edit_bfl_format-Q4_K_M.gguf', 'llm': _QWEN_VL['llm'],
                'vae': 'ae-flux1.safetensors', 'cfg': '4.5', 'pasos': 20, 'tope': 3600, 'bin': 'bin-nuevo',
                'extra': ['--llm_vision', '{M}/text/' + _QWEN_VL['mmproj'], '--flow-shift', '3'],
                'sampler': 'euler', 'lora': None, 'perfil': None, 'segundos': {'paso': 400, 'final': 1600}, 'estimacion': True,
                'archivos_extra': [('text', _QWEN_VL['mmproj'])]},
    # IMG-56: Qwen-Image 2.1 (Q4_K, ~8 B; licencia Qwen Research, no comercial), texto a imagen. Receta medida en la Deck (bin-nuevo):
    # pesos de difusión (4 GB) y VAE en Vulkan, texto (Qwen3-VL 8B, 4,3 GB) en CPU; sin --offload-to-cpu, --params-backend disk ni
    # --max-vram. 61 s/it a 1024x576 (~2540 s con 40 pasos). Pasos y Final en 16:9. `estimacion` es una sola marca: el paso (a 512x288) es estimado; la Final (2540 s) está medida.
    'qwen21': {'nombre': 'Qwen-Image 2.1 (Q4, texto a imagen)', 'modelo': 'qwen_image_2.1-Q4_K.gguf', 'llm': 'Qwen3VL-8B-Instruct-Q4_K_M.gguf',
               'vae': 'qwen_image_2.1_vae_bf16.safetensors', 'cfg': '6.0', 'pasos': 40, 'tope': 7200, 'bin': 'bin-nuevo',
               'base': ['--flash-attn', 'diffusion=on', '--vae-tiling', '--backend', 'te=cpu'],
               # IMG-57: easycache (umbral 0.2) se salta ~24 de 40 pasos: 2,3 veces más rápido y casi igual (SSIM 0.955)
               'extra': ['--model-args', 'qwen_image_2_1_prefix_cache_type=q4_0', '--cache-mode', 'easycache'],
               'sampler': 'euler', 'lora': None, 'perfil': None, 'sin_refs': True, 'vigila_mb': 1200,
               'tam_paso': (512, 288), 'tam_final': (1920, 768),
               'segundos': {'paso': 350, 'final': 3600}, 'estimacion': True},
    # Lo que hoy hace PERFIL=fotorreal de generar.sh (que fija modelo, texto, VAE, bin-nuevo y LoRA de estilo): no se duplica.
    'flux3': {'nombre': 'FLUX.3 klein (fotorrealista)', 'modelo': None, 'llm': None, 'vae': None, 'cfg': None, 'pasos': 8,
              'tope': 10800, 'bin': None, 'extra': [], 'lora': None, 'perfil': 'fotorreal',
              'segundos': {'paso': 300, 'final': 900}, 'estimacion': True,
              'archivos': [('diffusion', 'flux3-image-klein-Q8_0.gguf'), ('text', 'Qwen3VL-4B-Instruct-Q4_K_M.gguf'),
                           ('vae', 'flux2-vae.safetensors')]},
}


def motor(id_):
    if id_ not in MOTORES:
        raise KeyError(f'motor desconocido: {id_} ({", ".join(MOTORES)})')
    return MOTORES[id_]


def archivos(id_):
    """[(carpeta de modelos/, archivo)] que necesita el motor."""
    m = motor(id_)
    if m.get('archivos'):
        return list(m['archivos'])
    return [('diffusion', m['modelo']), ('text', m['llm']), ('vae', m['vae'])] + list(m.get('archivos_extra', []))


def faltan(id_, raiz, loras=None):
    """Rutas (relativas a image-generator/) de los archivos del motor que no están; si solo existe el `.part`, se dice."""
    perdidos = []
    for carpeta, nombre in archivos(id_):
        ruta = os.path.join(raiz, 'modelos', carpeta, nombre)
        if not os.path.isfile(ruta):
            perdidos.append(f'modelos/{carpeta}/{nombre}' + (' (solo existe el .part: la descarga no ha terminado)' if os.path.isfile(ruta + '.part') else ''))
    lora = motor(id_)['lora']
    if lora and not os.path.isfile(os.path.join(loras or os.path.join(raiz, 'loras'), lora[0] + '.safetensors')):
        perdidos.append(f'loras/{lora[0]}.safetensors')
    return perdidos


def mensaje_faltan(id_, perdidos):
    return f'el motor {id_} no está completo: falta {", ".join(perdidos)}'


def lista(raiz):
    """Para /api/inicio: [{id, nombre, disponible, faltan, pasos, segundosEstimados: {paso, final}, estimacion}]."""
    return [{'id': i, 'nombre': m['nombre'], 'disponible': not (p := faltan(i, raiz)), 'faltan': p, 'pasos': m['pasos'],
             'segundosEstimados': dict(m['segundos']), 'estimacion': m['estimacion'],
             'sinReferencias': bool(m.get('sin_refs'))} for i, m in MOTORES.items()]


def shell(id_, g):
    """Asignaciones para generar.sh (lo explícito manda: `${VAR:-…}`) o aborto con 3 si faltan archivos."""
    m = motor(id_)
    perdidos = faltan(id_, g, os.environ.get('LORAS'))
    if perdidos:
        print('echo ' + shlex.quote('ABORTO: ' + mensaje_faltan(id_, perdidos)) + '; exit 3')
        return 3
    sal = []
    if m['perfil']:
        sal.append(f'PERFIL=${{PERFIL:-{m["perfil"]}}}')
    else:
        for var, clave in (('MODELO', 'modelo'), ('LLM', 'llm'), ('VAE', 'vae'), ('CFG', 'cfg')):
            sal.append(f'{var}=${{{var}:-{shlex.quote(m[clave])}}}')
        sal.append(f'TOPE=${{TOPE:-{m["tope"]}}}')
        sal.append(f'SAMPLER=${{SAMPLER:-{m.get("sampler", "euler")}}}')
        sal.append(f'B=$G/{m["bin"]}')
        if m.get('base'):  # IMG-56: sustituyen a los args base de generar.sh
            sal.append('BASE_MOTOR=(' + ' '.join(shlex.quote(a) for a in m['base']) + ')')
        if m.get('vigila_mb'):
            sal.append(f'MIN_VIGILA_MB=${{MIN_VIGILA_MB:-{int(m["vigila_mb"])}}}')
        sal.append('EXTRA_MOTOR=(' + ' '.join(shlex.quote(a.replace('{M}', os.path.join(g, 'modelos'))) for a in m['extra']) + ')')
        if m['lora']:
            sal.append(f'LORA_MOTOR={shlex.quote(m["lora"][0] + ":" + m["lora"][1])}')
    print('\n'.join(sal))
    return 0


if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == 'shell':
        try:
            sys.exit(shell(sys.argv[2], sys.argv[3]))
        except KeyError as e:
            print('echo ' + shlex.quote('ABORTO: ' + e.args[0]) + '; exit 2')
            sys.exit(2)
    print('uso: motores.py shell <id> <image-generator/>')
    sys.exit(2)
