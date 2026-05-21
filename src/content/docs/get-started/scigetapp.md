---
title: Sciget App
description: A cross-platform desktop application for Sciget — the easiest way to use Scidesktop.
sidebar:
  order: 2
---

## Determine system privileges

Before running the app, check whether your system has privileged access (root/admin permissions). This determines which engine you need to use to run the app:

- If you **have** privileged access → use the Docker or Podman engine.
- If you **do not** have privileged access → use the TinyRange engine, or run a remote instance.

![Engine options](/docs/getting-started/scigetapp/engine-options.png)

## Minimum system requirements

1. At least 5 GB free space for the Scidesktop base image.
2. One of the following options, depending on system privileges:
   - **With privileged access**: Docker or Podman to run the respective engines.
   - **Without privileged access**: TinyRange engine (included with the Sciget App) and QEMU (only on macOS).

## Downloading Sciget App

- [Debian, Ubuntu Linux installer x64](https://github.com/scigetorg/scigetapp/releases/latest/download/ScigetApp-Setup-Debian-x64.deb)
- [Red Hat, Fedora, SUSE Linux installer x64](https://github.com/scigetorg/scigetapp/releases/latest/download/ScigetApp-Setup-Fedora-x64.rpm)
- [Debian, Ubuntu Linux installer arm64](https://github.com/scigetorg/scigetapp/releases/download/v1.8.0/ScigetApp-Setup-Debian-arm64.deb)
- [Red Hat, Fedora, SUSE Linux installer arm64](https://github.com/scigetorg/scigetapp/releases/latest/download/ScigetApp-Setup-Fedora-arm64.rpm)
- [macOS Intel installer](https://github.com/scigetorg/scigetapp/releases/latest/download/ScigetApp-Setup-macOS-x64.dmg), [macOS Apple silicon installer](https://github.com/scigetorg/scigetapp/releases/latest/download/ScigetApp-Setup-macOS-arm64.dmg)
- [Windows installer](https://github.com/scigetorg/scigetapp/releases/latest/download/ScigetApp-Setup-Windows.exe)

## Installing Docker

:::note
Docker is required to start a local instance of Sciget.
If you are only connecting to remote Sciget servers, you may **skip installing Docker**.
:::

The Sciget App requires Docker to be installed on your computer. If you already have Docker installed, you can skip this step.

- [Docker Desktop for Windows](https://docs.docker.com/docker-for-windows/install/)
- [Docker Desktop for Mac](https://docs.docker.com/docker-for-mac/install/)
- [Docker Engine for Linux](https://docs.docker.com/engine/install/)

After installation, open a terminal (Linux/macOS) or command prompt (Windows) and run the following command to verify that Docker is working correctly:

```bash
docker --version
docker run hello-world
```

## Installing QEMU

:::note
QEMU is only needed if you're using TinyRange on macOS.
It is not needed on Windows or Linux using TinyRange, since it's included in the install.
:::

The easiest way to install QEMU on macOS is using [Homebrew](https://brew.sh/):

```bash
brew install qemu
```

You can verify the installation by running:

```bash
qemu-system-aarch64 --version
```

## Installing Sciget App

If you have an existing Sciget App installation, first uninstall it by following the [uninstall instructions](#uninstalling-sciget-app). Then, install the app for your system:

- **Debian, Ubuntu Linux**: `sudo apt install -f ./ScigetApp-Setup-Debian.deb`
- **Red Hat, Fedora, SUSE Linux**: `sudo rpm -i ScigetApp-Setup-Fedora.rpm`
- **macOS**: Double-click the downloaded `.dmg` file, then drag `ScigetApp.app` to the Applications folder. To start the app: right-click `ScigetApp.app` and select **Open**. On Apple Silicon (M1/M2), enable Rosetta support in the Docker settings for best performance.
- **Windows**: Double-click the downloaded `.exe` file. Accept to install from an unknown publisher with **Yes**, accept the licence agreement, and click **Finish**.

## Launching Sciget App

The Sciget App can be launched directly from your operating system's application menu, or by running the `scigetapp` command in the command line.

:::tip
The Sciget App will set the File Browser's root directory based on the launch method used. The default working directory is the user's home directory — this can be customised from the Settings dialog.
:::

## Sessions and projects

Sessions represent local project launches and connections to existing Sciget servers. Each Sciget UI window in the app is associated with a separate session, and sessions can be restored with the same configuration later.

### Session start options

You can start a new session by using the links at the **Start** section of the Welcome Page.

![Start session](/docs/getting-started/scigetapp/start-session.png)

- **Launch Local** creates a new session in the default working directory.
- **Launch Remote** creates a session by connecting to a remote Sciget server.

Previously opened sessions are stored as part of application data and are listed on the Welcome Page. Clicking an item in the **Recent sessions** list restores the selected session.

## Connecting to local Sciget

The Sciget App creates new sessions by launching a locally running server and connecting to it. To open a local instance, click the **Launch Local** button on the mini app you want to start.

![Connect to local](/docs/getting-started/scigetapp/connect-to-local.png)

## Connecting to a remote server

The app can also connect to an existing server instance for each mini app that is running remotely. To connect to a server, click the **Launch Remote** button.

![Connect to server](/docs/getting-started/scigetapp/connect-to-server.png)

This launches a dialog that automatically lists the remote server instances for that app.

Select a server from the list, or enter the URL of the application server. If the server requires a token for authentication, include it as a query parameter of the URL (`/lab?token=<token-value>`). After entering a URL, hit `Enter` to connect.

Use your GitHub credentials to log in, then click **Start** to launch Scidesktop. The app will load into the new desktop in about a minute. The resulting JupyterLab environment has all software on the left-hand panel available as modules.

Click the **scidesktop** icon to open the full Linux desktop. Choose **Desktop RDP** (recommended) or **Desktop VNC**. The app will load into a full Linux desktop environment with **Software-Applications** on the desktop to choose from.

:::note
If the **Persist session data** option is checked, the session information is stored and the Sciget App reuses this data on the next launch. If unchecked, the session data is automatically deleted at the next launch and servers requiring authentication will prompt for re-login.
:::

## Privacy settings

You can delete stored session data manually at any time using the **Clear History** option in the Privacy tab of the Settings dialog.

![Settings privacy](/docs/getting-started/scigetapp/settings-privacy.png)

## Configuration and data files

Mini apps store data in `~/<miniapp>-storage` on Linux and macOS, or `C:/<miniapp>-storage` on Windows by default.

## Add a custom data directory

The Sciget App stores its data in the following locations:

- By default, `/home/jovyan/<miniapp>-storage` in the app, bound to the local directory `~/<miniapp>-storage` on Unix/macOS or `C:/<miniapp>-storage` on Windows.
- By choice, in the settings window, select **Additional Directory** on the left sidebar, click **Change** to select the local directory, then click **Apply & Restart**. On next launch, the data from the local directory can be found in `/home/jovyan/data`.

:::caution
On Windows, it is currently not possible to mount external hard drives. We recommend copying data from the external drive to your local disk first and then processing it in the app.
:::

:::note
On macOS with Docker, mounting an external hard drive works out of the box. On Podman, modify the Podman machine settings with the following commands once, then set the path in the app:

```bash
podman machine reset -f
podman machine init --rootful --now -v /Volumes:/Volumes -v $HOME:$HOME podman-machine-default
```
:::

![Additional directory](/docs/getting-started/scigetapp/additional_dir.png)

:::tip
If you are using conda environments and installing packages or new kernels, read [this guide](https://neurodesk.org/tutorials-examples/tutorials/programming/conda/).
:::

## Troubleshooting Sciget App

### `/var/run/docker.sock: connect: permission denied`

This means Docker is not correctly set up yet. Run:

```bash
sudo groupadd docker
sudo usermod -aG docker $USER
newgrp docker

sudo chown root:docker /var/run/docker.sock
sudo chmod 666 /var/run/docker.sock
```

### `FATAL:setuid_sandbox_host.cc(158)`

If you see the error `FATAL:setuid_sandbox_host.cc(158)] The SUID sandbox helper binary was found, but is not configured correctly...`, this is caused by a recent change in Ubuntu 24.04.

A temporary workaround: create the file `/etc/apparmor.d/scigetapp` with this content:

```text
# This profile allows everything and only exists to give the
# application a name instead of having the label "unconfined"

abi <abi/4.0>,
include <tunables/global>

profile scigetapp "/opt/ScigetApp/scigetapp" flags=(unconfined) {
  userns,

  # Site-specific additions and overrides. See local/README for details.
  include if exists <local/scigetapp>
}
```

Then restart your computer and try to start the Sciget App again.

## Uninstalling Sciget App

### Debian, Ubuntu Linux

```bash
sudo apt-get purge scigetapp # remove application
sudo rm /usr/bin/scigetapp # remove command symlink
rm -rf ~/.config/scigetapp # remove application cache
```

### Red Hat, Fedora, SUSE Linux

```bash
sudo rpm -e scigetapp # remove application
sudo rm /usr/bin/scigetapp # remove command symlink
rm -rf ~/.config/scigetapp # remove application cache
```

### macOS

Find the application installation `ScigetApp.app` in Finder (in `/Applications` or `~/Applications`) and move to Trash using `CMD + Delete`. Clean other application-generated files using:

```bash
rm -rf ~/Library/scigetapp # remove application cache
rm -rf ~/Library/Application\ Support/scigetapp # remove user data
```

### Windows

On Windows, go to **Windows Apps & Features** via **Start Menu → Settings → Apps** and uninstall Sciget App.

To remove the application cache, delete `C:\Users\<username>\AppData\Roaming\scigetapp`. The `AppData` directory is hidden — activate hidden items in Windows Explorer under **View → Show → Hidden Items**.
