---
title: Instalá Menkar
description: Instalá Menkar en Linux desde su paquete .deb o .rpm, y el agente que corre.
sidebar:
  order: 1
---

Menkar corre en Linux, en x86 de 64 bits (amd64). Cada versión trae dos paquetes: un `.deb` para
Debian, Ubuntu y sus derivadas, y un `.rpm` para Fedora y otros sistemas RPM. No hay versión para
Windows.

## Instalá un agente primero

Menkar corre el agente de código que ya usás; no trae uno. Instalá al menos uno e iniciá sesión en
él, para que su comando esté en tu `PATH`:

- Claude Code, el comando `claude`, 2.1.267 o posterior;
- Codex, el comando `codex`;
- el agente de Cursor, el comando `cursor-agent`;
- OpenCode, el comando `opencode`.

[Usá Claude Code, Codex, Cursor u OpenCode](/menkar/es/start/agents/) dice qué puede hacer cada uno en Menkar.

## Instalá en Debian o Ubuntu

1. Descargá la clave de firma del repositorio y mostrala:

   ```sh
   curl -fsSL -o /tmp/menkar.key https://dl.cloudsmith.io/public/menkar/menkar-packages/gpg.32B297F2B56D38CD.key
   gpg --show-keys /tmp/menkar.key
   ```

   Seguí solo si muestra la huella `4D80 2D23 F528 B669 95C6  529D 32B2 97F2 B56D 38CD`.

2. Agregá la clave y el repositorio, e instalá:

   ```sh
   sudo gpg --dearmor --yes -o /usr/share/keyrings/menkar-archive-keyring.gpg /tmp/menkar.key
   echo "deb [signed-by=/usr/share/keyrings/menkar-archive-keyring.gpg] https://dl.cloudsmith.io/public/menkar/menkar-packages/deb/any-distro any-version main" | sudo tee /etc/apt/sources.list.d/menkar.list
   sudo apt update
   sudo apt install menkar
   ```

Después, `sudo apt upgrade` trae cada versión nueva. El alojamiento del repositorio de paquetes lo
brinda generosamente [Cloudsmith](https://cloudsmith.com), que registra la dirección de cada
descarga. Para que tu máquina no lo contacte, instalá en cambio el paquete de la última versión:

1. Descargá `menkar_<versión>_amd64.deb` y `SHA256SUMS` de la
   [última versión](https://github.com/hernancontigiani/menkar/releases/latest) en una misma carpeta.
2. En esa carpeta, verificá la descarga e instalala:

   ```sh
   sha256sum --check --ignore-missing SHA256SUMS
   sudo apt install ./menkar_*_amd64.deb
   ```

El paquete también instala un perfil de AppArmor, `/etc/apparmor.d/menkar`, que le permite a Menkar
correr con el sandbox de Chromium en Ubuntu 24.04 y posteriores.

## Instalá en Fedora

Agregá el repositorio e instalá, así `sudo dnf upgrade` trae cada versión nueva:

```sh
sudo rpm --import https://dl.cloudsmith.io/public/menkar/menkar-packages/gpg.32B297F2B56D38CD.key
sudo tee /etc/yum.repos.d/menkar.repo > /dev/null <<'EOF'
[menkar]
name=Menkar
baseurl=https://dl.cloudsmith.io/public/menkar/menkar-packages/rpm/any-distro/any-version/$basearch
enabled=1
gpgcheck=1
repo_gpgcheck=1
gpgkey=https://dl.cloudsmith.io/public/menkar/menkar-packages/gpg.32B297F2B56D38CD.key
EOF
sudo dnf install menkar
```

Si dnf pide importar una clave, aceptala solo si su huella es `4D80 2D23 F528 B669 95C6  529D 32B2 97F2 B56D 38CD`. dnf descarga de Cloudsmith,
que registra la dirección de cada descarga. Para que tu máquina no lo contacte, instalá en cambio el
paquete de la última versión:

1. Descargá `menkar-<versión>.x86_64.rpm` y `SHA256SUMS` de la
   [última versión](https://github.com/hernancontigiani/menkar/releases/latest) en una misma carpeta.
2. En esa carpeta, verificá la descarga e instalala:

   ```sh
   sha256sum --check --ignore-missing SHA256SUMS
   sudo dnf install ./menkar-*.x86_64.rpm
   ```

## Abrí Menkar

Abrí **Menkar** desde tus aplicaciones, o corrélo desde una terminal:

```sh
menkar
```

Te devuelve la terminal enseguida y sigue corriendo cuando la cerrás. Para dejarlo atado a la
terminal y ver su log, corré `menkar --foreground`. Para ver qué build tenés:

```sh
menkar --version
```

Después [abrí tus primeras sesiones](/menkar/es/start/first-sessions/).

## Actualizá o quitá Menkar

Para actualizarlo, instalá el paquete más nuevo de la misma forma: reemplaza al que tenés.

Para quitarlo, corré la línea de tu sistema. Tus proyectos, tu configuración y tu historial de uso
quedan en tu carpeta personal, igual que las sesiones de tus agentes.

```sh
sudo apt remove menkar
```

```sh
sudo dnf remove menkar
```
