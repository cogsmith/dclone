# DCLONE: Terminal Menu Guided Disk Imaging
## Simple frontend for common open-source tools: lsblk dd squashfs kpartx

---

<a href='https://github.com/cogsmith/dclone'><img src='https://github-readme-stats.vercel.app/api/pin/?username=cogsmith&repo=dclone' align='right'></a>

#### <code><a href='https://github.com/cogsmith/dclone'><img src='https://github.githubassets.com/images/icons/emoji/octocat.png' width='22'> [GITHUB REPO]</a></code>

#### <code><a href='https://github.com/cogsmith/dclone/blob/main/app.js'>🧾 [VIEW APP SOURCE CODE]</a></code>

#### <code><a href='https://github.com/cogsmith/dclone/projects/1'>📅 [PROJECT TRACKER BOARD]</a></code>

---

[![](https://shields.io/github/package-json/v/cogsmith/dclone?label=codebase)](http://github.com/cogsmith/dclone)
[![](https://shields.io/github/last-commit/cogsmith/dclone)](https://github.com/cogsmith/dclone/commits/main)
[![](https://github.com/cogsmith/dclone/actions/workflows/DEVKING_CHECK.yml/badge.svg)](https://github.com/cogsmith/dclone/actions/workflows/DEVKING_CHECK.yml)

[![](https://shields.io/github/v/release/cogsmith/dclone?label=latest+release)](https://github.com/cogsmith/dclone/releases)
[![](https://shields.io/github/release-date/cogsmith/dclone?color=blue)](https://github.com/cogsmith/dclone/releases)
[![](https://shields.io/github/commits-since/cogsmith/dclone/latest)](https://github.com/cogsmith/dclone/commits/main)
<!-- [![](https://shields.io/github/commit-activity/m/cogsmith/dclone)](https://github.com/cogsmith/dclone/commits/main) -->

[![](https://shields.io/github/license/cogsmith/dclone?color=lightgray)](https://github.com/cogsmith/dclone/blob/main/LICENSE)
[![](https://shields.io/github/languages/code-size/cogsmith/dclone)](http://github.com/cogsmith/dclone)
[![](https://shields.io/github/repo-size/cogsmith/dclone)](http://github.com/cogsmith/dclone)
[![](https://shields.io/github/issues-raw/cogsmith/dclone)](https://github.com/cogsmith/dclone/issues)

---

* lsblk
* dd
* squashfs
* kpartx

---

Single step streaming technique originally sourced from this StackOverflow post:
https://unix.stackexchange.com/a/75590/23232

---

![SCREENSHOT](SCREENCAP.GIF)

---

<p>Disk cloning app that uses open-source tools like dd mksquashfs and kpartx to backup and restore images easily.</p>
<p>It gives a guided menu interface to picking out a disk and entering a filename, then lets you observe the streaming output from spawned tasks in an embedded tty buffer.</p>
