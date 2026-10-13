"""QA-74: utilidades de los tests de tools/qa (repos de git de prueba en carpetas temporales)."""
import atexit
import os
import shutil
import subprocess
import tempfile

QA = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ENV_GIT = {**os.environ, 'GIT_AUTHOR_NAME': 't', 'GIT_AUTHOR_EMAIL': 't@t', 'GIT_COMMITTER_NAME': 't',
           'GIT_COMMITTER_EMAIL': 't@t', 'GIT_CONFIG_GLOBAL': os.devnull, 'GIT_CONFIG_SYSTEM': os.devnull}


def git(cwd: str, *args: str) -> str:
    return subprocess.run(['git', *args], cwd=cwd, env=ENV_GIT, check=True, capture_output=True, text=True).stdout.strip()


def escribir(ruta: str, texto: str) -> None:
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, 'w', encoding='utf-8') as f:
        f.write(texto)


def leer(ruta: str) -> str:
    with open(ruta, encoding='utf-8') as f:
        return f.read()


def carpeta() -> str:
    ruta = tempfile.mkdtemp(prefix='qa-test-')
    atexit.register(shutil.rmtree, ruta, True)
    return ruta
