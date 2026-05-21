---
title: About SCIGET
description: SCIGET is a community-engaged scientific software distribution system.
---

## Background

The analysis of scientific data necessitates specialised software and complex processing pipelines. Researchers and research infrastructure maintainers expend significant time and effort on software compilation, installation, and managing deployments across diverse computing platforms (laptops, workstations, HPCs, cloud). Additionally, system-specific dependency issues and challenges in publishing reproducible pipelines alongside data often compromise research outcomes.

## Introduction

SCIGET aims to deliver a robust solution tackling these challenges in scientific software accessibility and research reproducibility. Leveraging containerisation and projects like [Neurodesk](https://neurodesk.org), [CernVM-FS](https://cernvm.cern.ch/fs/), [EESSI](https://eessi.io), and TinyRange, SCIGET provides a robust software distribution system alongside accessible and portable virtual desktops that can be co-located with data for scientific analysis.

![SCIGET overview](/docs/about/image.png)
> Developing a scientific community-oriented software distribution system

## Methods

At the core is a community-engaged build pipeline, where scientific applications and reference datasets are proposed, packaged, security scanned, and published to container registries. Applications are accessible via graphical virtual desktops embedded into JupyterLab, and command line as modules.

Containers run on infrastructure through a variety of mechanisms:

- Apptainer/Singularity and CernVM-FS on HPCs
- Kubernetes on research and commercial cloud
- Docker/Podman or unprivileged QEMU VMs for researchers

A comprehensive metadata database provides easy tool discovery. In collaboration with the National Imaging Facility, SCIGET is integrated into the Australian Imaging Service, offering biomedical imaging researchers a comprehensive data and analysis solution.

![Submission flow](/docs/about/submission-flow.svg)

## Conclusion

SCIGET accelerates scientific discovery by streamlining access to essential software. It reduces setup overhead, enhances reproducibility across computing platforms, and fosters greater collaboration by ensuring consistent analytical environments. SCIGET is domain agnostic and seeks collaboration to expand across scientific domains via community engagement.
