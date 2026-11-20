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
- el agente de Cursor, el comando `cursor-agent`.

[Usá Claude Code o Cursor](/menkar/es/start/agents/) dice qué puede hacer cada uno en Menkar.

## Instalá en Debian o Ubuntu

<!-- plan 28: apt commands -->
<!-- /plan 28 -->

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

<!-- plan 28: rpm commands -->
<!-- /plan 28 -->

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
