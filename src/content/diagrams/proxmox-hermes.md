---
title: NUC automation and agent architecture
summary: Runtime topology for Proxmox, Home Assistant, and the host-native Hermes services on the home NUC.
date: 2026-10-13
order: 1
tags:
  - Proxmox
  - Home Assistant
  - Hermes
diagram: diagrams/proxmox-hermes-architecture.html
---

## Overview

The physical NUC runs Proxmox VE 9.2.2. Home Assistant is isolated in VM 100 with two virtual CPU cores and 4 GB of memory, while Hermes runs directly on the Proxmox host as user-level services.

## Routes

Local devices access Home Assistant over the home network. Browser sessions enter through the Hermes Dashboard, WhatsApp messages terminate at the Agent Gateway, and phone calls travel through Twilio and ngrok before reaching the Hermes Phone Bridge.

The Home Assistant API represents the logical automation path between Home Assistant and Hermes. It is an architectural relationship rather than a captured network trace.

## Deployment notes

The standalone diagram is stored under `public/diagrams/`, so Astro copies it into the final build without transformation. Its desktop SVG keeps a readable fixed canvas, while narrow screens receive a compact route map.
